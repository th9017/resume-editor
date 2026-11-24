const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const MAX_COMMENT_LENGTH = 0xffff
const STORED = 0
const DEFLATE = 8

export interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  uncompressedSize: number
  localOffset: number
}

const decoder = new TextDecoder('utf-8')

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer as ArrayBuffer
  }
  return data.slice().buffer as ArrayBuffer
}

/** ZIP 的注释可达 64KB，结束记录只能从尾部往前扫 */
function findEndOfCentralDirectory(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - 22 - MAX_COMMENT_LENGTH)
  for (let index = view.byteLength - 22; index >= lowest; index -= 1) {
    if (view.getUint32(index, true) === EOCD_SIGNATURE) return index
  }
  return -1
}

export function isZip(data: Uint8Array): boolean {
  return (
    data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04
  )
}

export function listZipEntries(data: Uint8Array): ZipEntry[] {
  const view = new DataView(toArrayBuffer(data))
  const end = findEndOfCentralDirectory(view)
  if (end < 0) throw new Error('文件不是有效的 ZIP 归档（DOCX 本质是 ZIP）')
  const count = view.getUint16(end + 10, true)
  let cursor = view.getUint32(end + 16, true)
  const entries: ZipEntry[] = []
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) break
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error('该文件使用 Zip64 格式，暂不支持')
    }
    entries.push({
      name: decoder.decode(
        new Uint8Array(view.buffer, view.byteOffset + cursor + 46, nameLength),
      ),
      method: view.getUint16(cursor + 10, true),
      compressedSize,
      uncompressedSize,
      localOffset: view.getUint32(cursor + 42, true),
    })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** 本地头里的长度字段和中央目录可以不同，数据起点要按本地头算 */
function dataOffset(view: DataView, entry: ZipEntry): number {
  if (view.getUint32(entry.localOffset, true) !== LOCAL_SIGNATURE) {
    throw new Error(`ZIP 条目 ${entry.name} 的本地头已损坏`)
  }
  const nameLength = view.getUint16(entry.localOffset + 26, true)
  const extraLength = view.getUint16(entry.localOffset + 28, true)
  return entry.localOffset + 30 + nameLength + extraLength
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前运行环境不支持解压 DOCX')
  }
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function readZipEntry(
  data: Uint8Array,
  entries: ZipEntry[],
  name: string,
): Promise<Uint8Array | null> {
  const entry = entries.find((candidate) => candidate.name === name)
  if (!entry) return null
  const view = new DataView(toArrayBuffer(data))
  const start = dataOffset(view, entry)
  const raw = new Uint8Array(view.buffer, view.byteOffset + start, entry.compressedSize)
  if (entry.method === STORED) return raw
  if (entry.method === DEFLATE) return await inflateRaw(raw)
  throw new Error(`ZIP 条目 ${name} 使用了不支持的压缩方式 ${entry.method}`)
}

export async function readZipText(data: Uint8Array, name: string): Promise<string | null> {
  const entries = listZipEntries(data)
  const bytes = await readZipEntry(data, entries, name)
  return bytes ? decoder.decode(bytes) : null
}
