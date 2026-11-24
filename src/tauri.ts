import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import {
  exists,
  mkdir,
  readFile,
  readTextFile as fsReadTextFile,
  stat,
  writeFile,
  writeTextFile as fsWriteTextFile,
} from '@tauri-apps/plugin-fs'
import { openUrl } from '@tauri-apps/plugin-opener'

export async function pickMarkdownFile(options: { docx?: boolean } = {}): Promise<string | null> {
  const path = await open({
    multiple: false,
    directory: false,
    title: '打开简历',
    filters: options.docx
      ? [{ name: '简历', extensions: ['md', 'markdown', 'docx'] }]
      : [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
  return typeof path === 'string' ? path : null
}

export async function pickSavePath(
  defaultName: string,
  defaultPath?: string,
): Promise<string | null> {
  const path = await save({
    defaultPath: defaultPath || defaultName,
    title: '保存简历',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  return typeof path === 'string' ? path : null
}

export async function pickImageFile(): Promise<string | null> {
  const path = await open({
    multiple: false,
    directory: false,
    title: '选择图片',
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  })
  return typeof path === 'string' ? path : null
}

export async function pickPdfPath(defaultPath: string): Promise<string | null> {
  const path = await save({
    defaultPath,
    title: '导出 PDF',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  return typeof path === 'string' ? path : null
}

/** 用本机 Edge/Chrome 无头打印直接写 PDF；失败时抛错，由调用方回退系统打印 */
export async function exportPdf(html: string, pdfPath: string): Promise<string> {
  return await invoke<string>('print_html_to_pdf', { html, pdfPath })
}

export async function readTextFile(path: string): Promise<string> {
  return await fsReadTextFile(path)
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  await fsWriteTextFile(path, text)
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  return await readFile(path)
}

export async function writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
  await writeFile(path, data)
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export async function fileExists(path: string): Promise<boolean> {
  return await exists(path)
}

export async function fileMtime(path: string): Promise<number | null> {
  try {
    const info = await stat(path)
    return info.mtime ? new Date(info.mtime).getTime() : null
  } catch {
    return null
  }
}

export function assetUrl(path: string): string {
  return convertFileSrc(path)
}

export async function openExternal(url: string): Promise<void> {
  if (!/^(https?:|mailto:|tel:)/i.test(url)) return
  try {
    await openUrl(url)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}