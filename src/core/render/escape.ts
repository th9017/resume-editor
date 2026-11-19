export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[character] ?? character
  })
}

export function isSafeLink(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href.trim())
}

export function isSafeImageSrc(src: string): boolean {
  const value = src.trim()
  if (!value) return false
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(value)
  if (!match) return true
  const scheme = match[1].toLowerCase()
  if (scheme === 'http' || scheme === 'https' || scheme === 'asset') return true
  if (scheme === 'data') return /^data:image\//i.test(value)
  return false
}