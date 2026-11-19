import { isAbsolutePath, parentDir, resolveRelative, safeDecode } from './paths'
import type { ResumeDoc } from './types'

const IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

export function collectImageRefs(doc: ResumeDoc): string[] {
  const refs = new Set<string>()
  if (doc.identity.avatar.trim()) refs.add(doc.identity.avatar.trim())
  const scan = (text: string): void => {
    for (const match of text.matchAll(IMAGE_RE)) {
      const ref = match[1]?.trim()
      if (ref) refs.add(ref)
    }
  }
  scan(doc.preamble)
  for (const section of doc.sections) {
    scan(section.body)
    for (const item of section.items) {
      scan(item.body)
      for (const value of Object.values(item.fields)) scan(value)
    }
  }
  return [...refs]
}

export function isLocalImageRef(ref: string): boolean {
  return !/^(https?:|data:|blob:|asset:|file:)/i.test(ref)
}

export function resolveImagePath(docPath: string, ref: string): string | null {
  if (!docPath || !ref || !isLocalImageRef(ref)) return null
  if (isAbsolutePath(ref)) return safeDecode(ref)
  return resolveRelative(parentDir(docPath), ref)
}

export async function fileToDataUrl(
  path: string,
  reader: (path: string) => Promise<Uint8Array>,
): Promise<string> {
  const bytes = await reader(path)
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  const ext = path.split('.').pop()?.toLowerCase() ?? 'png'
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'svg'
            ? 'image/svg+xml'
            : 'image/png'
  return `data:${mime};base64,${btoa(binary)}`
}

export function assetFileName(prefix: string, ext: string): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const suffix = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  return `${prefix}-${stamp}-${suffix}.${ext}`
}