import { deflateRawSync } from 'node:zlib'

const encoder = new TextEncoder()
const EMPTY = new Uint8Array(0)

export interface RawZipEntry {
  name: string
  content: string
  deflate?: boolean
  /** 本地头不写长度、尾部追加数据描述符，模拟流式打包器 */
  dataDescriptor?: boolean
  /** 本地头附加字段，用于验证数据起点不是固定值 */
  localExtra?: string
}

function localHeader(entry: RawZipEntry, payload: Uint8Array, raw: Uint8Array): Uint8Array {
  const name = encoder.encode(entry.name)
  const extra = entry.localExtra ? encoder.encode(entry.localExtra) : EMPTY
  const buffer = new Uint8Array(30 + name.length + extra.length)
  const view = new DataView(buffer.buffer)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, entry.dataDescriptor ? 0x08 : 0, true)
  view.setUint16(8, entry.deflate ? 8 : 0, true)
  // 读取端不校验 CRC，所以描述符模式下这些字段留 0 也足够真实
  if (!entry.dataDescriptor) {
    view.setUint32(18, payload.length, true)
    view.setUint32(22, raw.length, true)
  }
  view.setUint16(26, name.length, true)
  view.setUint16(28, extra.length, true)
  buffer.set(name, 30)
  buffer.set(extra, 30 + name.length)
  return buffer
}

function centralHeader(
  entry: RawZipEntry,
  payload: Uint8Array,
  raw: Uint8Array,
  localOffset: number,
): Uint8Array {
  const name = encoder.encode(entry.name)
  const buffer = new Uint8Array(46 + name.length)
  const view = new DataView(buffer.buffer)
  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(10, entry.deflate ? 8 : 0, true)
  view.setUint32(20, payload.length, true)
  view.setUint32(24, raw.length, true)
  view.setUint16(28, name.length, true)
  view.setUint32(42, localOffset, true)
  buffer.set(name, 46)
  return buffer
}

function descriptor(compressedSize: number, uncompressedSize: number): Uint8Array {
  const buffer = new Uint8Array(16)
  const view = new DataView(buffer.buffer)
  view.setUint32(0, 0x08074b50, true)
  view.setUint32(8, compressedSize, true)
  view.setUint32(12, uncompressedSize, true)
  return buffer
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const chunk of chunks) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  return out
}

/** 构造最小可用的 ZIP：只覆盖 DOCX 读取端会碰到的字段 */
export function buildZip(entries: RawZipEntry[], comment = ''): Uint8Array {
  const body: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const raw = encoder.encode(entry.content)
    const payload = entry.deflate ? new Uint8Array(deflateRawSync(raw)) : raw
    const local = localHeader(entry, payload, raw)
    body.push(local, payload)
    let consumed = local.length + payload.length
    if (entry.dataDescriptor) {
      const tail = descriptor(payload.length, raw.length)
      body.push(tail)
      consumed += tail.length
    }
    central.push(centralHeader(entry, payload, raw, offset))
    offset += consumed
  }
  const directory = concat(central)
  const commentBytes = encoder.encode(comment)
  const end = new Uint8Array(22 + commentBytes.length)
  const view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, entries.length, true)
  view.setUint16(10, entries.length, true)
  view.setUint32(12, directory.length, true)
  view.setUint32(16, offset, true)
  view.setUint16(20, commentBytes.length, true)
  end.set(commentBytes, 22)
  return concat([...body, directory, end])
}
