export function isAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('/')
}

export function joinPath(dir: string, name: string): string {
  if (!dir) return name
  if (!name) return dir
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.endsWith('\\') || dir.endsWith('/') ? dir + name : dir + sep + name
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function parentDir(path: string): string {
  const index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  if (index < 0) return ''
  if (index === 0) return path.slice(0, 1)
  if (index === 2 && path[1] === ':') return path.slice(0, 3)
  return path.slice(0, index)
}

export function stripDotSlash(path: string): string {
  return path.replace(/^\.\//, '')
}

export function safeDecode(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

export function resolveRelative(baseDir: string, ref: string): string {
  if (!ref) return ref
  if (/^(?:https?:|data:|blob:|asset:|mailto:|tel:)/i.test(ref)) return ref
  if (isAbsolutePath(ref)) return ref
  const sep = baseDir.includes('\\') ? '\\' : '/'
  let decoded = stripDotSlash(safeDecode(ref))
  decoded = sep === '\\' ? decoded.replace(/\//g, '\\') : decoded.replace(/\\/g, '/')
  return joinPath(baseDir, decoded)
}

/** 副本文件名：简历.md → 简历-副本.md → 简历-副本-2.md */
export function copyCandidate(path: string, attempt: number): string {
  const base = baseName(path)
  const stem = base.replace(/\.(md|markdown)$/i, '')
  const ext = stem === base ? '.md' : base.slice(stem.length)
  const suffix = attempt <= 1 ? '-副本' : `-副本-${attempt}`
  return joinPath(parentDir(path), `${stem}${suffix}${ext}`)
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || '未命名简历'
}