import { parseDocument } from 'yaml'
import {
  CONTACT_LABELS,
  CONTACT_ORDER,
  DEFAULT_STYLE,
  type ContactItem,
  type Diagnostic,
  type DocStyle,
  type FmInfo,
  type ResumeIdentity,
  type Severity,
  type Spacing,
  type TemplateId,
} from './types'

const TEMPLATES: TemplateId[] = ['classic', 'sidebar', 'compact']
const SPACINGS: Spacing[] = ['compact', 'normal', 'relaxed']
const ACCENT_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export interface FrontmatterRead {
  fm: FmInfo | null
  body: string
  bodyStartLine: number
  identity: ResumeIdentity
  style: DocStyle
  diagnostics: Diagnostic[]
}

export function emptyIdentity(): ResumeIdentity {
  return { name: '', title: '', contacts: [], avatar: '' }
}

export function normalizeSource(source: string): string {
  return source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function readFrontmatter(source: string): FrontmatterRead {
  const normalized = normalizeSource(source)
  const lines = normalized.split('\n')
  const diagnostics: Diagnostic[] = []
  const defaults = (): FrontmatterRead => ({
    fm: null,
    body: normalized,
    bodyStartLine: 1,
    identity: emptyIdentity(),
    style: { ...DEFAULT_STYLE },
    diagnostics,
  })

  if (lines[0]?.trim() !== '---') return defaults()

  let closing = -1
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === '---' || trimmed === '...') {
      closing = i
      break
    }
  }

  if (closing === -1) {
    diag(diagnostics, 1, 'warn', 'FM_UNCLOSED', 'frontmatter 未闭合，已按正文处理')
    return defaults()
  }

  const rawLines = lines.slice(1, closing)
  const raw = rawLines.join('\n')
  const fm: FmInfo = {
    raw,
    startLine: 1,
    endLine: closing + 1,
    data: null,
  }

  let data: Record<string, unknown> | null = null
  if (raw.trim() !== '') {
    try {
      const doc = parseDocument(raw, { prettyErrors: false })
      if (doc.errors.length > 0) {
        const first = doc.errors[0]
        const line = 1 + (first.linePos?.[0]?.line ?? 1)
        diag(diagnostics, line, 'error', 'FM_YAML', `frontmatter 解析失败：${first.message}`)
      } else {
        const parsed: unknown = doc.toJS()
        if (isRecord(parsed)) {
          data = parsed
        } else if (parsed != null) {
          diag(diagnostics, 1, 'warn', 'FM_NOT_MAP', 'frontmatter 不是键值对象，已使用默认信息')
        } else {
          data = {}
        }
      }
    } catch (error) {
      diag(
        diagnostics,
        1,
        'error',
        'FM_YAML',
        `frontmatter 解析失败：${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } else {
    data = {}
  }

  fm.data = data
  const identity = readIdentity(data, diagnostics, rawLines)
  const style = readStyle(data, diagnostics, rawLines)

  return {
    fm,
    body: lines.slice(closing + 1).join('\n'),
    bodyStartLine: closing + 2,
    identity,
    style,
    diagnostics,
  }
}

export function readStyle(
  data: Record<string, unknown> | null,
  diagnostics: Diagnostic[] = [],
  rawLines: string[] = [],
): DocStyle {
  const result: DocStyle = { ...DEFAULT_STYLE }
  if (!data || data.style == null) return result

  if (!isRecord(data.style)) {
    diagAt(rawLines, diagnostics, 'style', 'warn', 'STYLE_TYPE', 'style 必须是键值对象，已使用默认样式')
    return result
  }

  const raw = data.style
  const template = asText(pick(raw, 'template', 'template')).toLowerCase()
  if (template) {
    if (TEMPLATES.includes(template as TemplateId)) {
      result.template = template as TemplateId
    } else {
      diagAt(rawLines, diagnostics, 'template', 'warn', 'STYLE_TEMPLATE', '未知模板，已回退为 classic')
    }
  }

  const accentRaw = asText(pick(raw, 'accent', 'accent'))
  if (accentRaw) {
    const accent = normalizeAccent(accentRaw)
    if (accent) {
      result.accent = accent
    } else {
      diagAt(rawLines, diagnostics, 'accent', 'warn', 'STYLE_ACCENT', '主题色格式无效，已回退默认颜色')
    }
  }

  const fontRaw = pick(raw, 'fontSize', 'font_size')
  if (fontRaw != null && fontRaw !== '') {
    const value = typeof fontRaw === 'number' ? fontRaw : Number.parseFloat(String(fontRaw))
    if (Number.isFinite(value)) {
      result.fontSize = Math.round(Math.min(12, Math.max(8.5, value)) * 10) / 10
    } else {
      diagAt(rawLines, diagnostics, 'font_size', 'warn', 'STYLE_FONT_SIZE', '字号无效，已回退为 10.5')
    }
  }

  const spacing = asText(pick(raw, 'spacing', 'spacing')).toLowerCase()
  if (spacing) {
    if (SPACINGS.includes(spacing as Spacing)) {
      result.spacing = spacing as Spacing
    } else {
      diagAt(rawLines, diagnostics, 'spacing', 'warn', 'STYLE_SPACING', '未知间距，已回退为 normal')
    }
  }

  const autoFitRaw = pick(raw, 'autoFit', 'auto_fit')
  if (autoFitRaw != null) {
    const parsed = parseBool(autoFitRaw)
    if (parsed == null) {
      diagAt(rawLines, diagnostics, 'auto_fit', 'warn', 'STYLE_AUTO_FIT', 'auto_fit 必须是布尔值，已回退为 true')
    } else {
      result.autoFit = parsed
    }
  }

  return result
}

function readIdentity(
  data: Record<string, unknown> | null,
  diagnostics: Diagnostic[],
  rawLines: string[],
): ResumeIdentity {
  if (!data) return emptyIdentity()

  const name = asText(data.name)
  const title = asText(data.title) || asText(data.position)
  const avatar = asText(data.avatar)

  const contactValue = data.contact
  if (contactValue != null && !isRecord(contactValue)) {
    diagAt(rawLines, diagnostics, 'contact', 'warn', 'CONTACT_TYPE', 'contact 必须是键值对象，已忽略')
  }
  const contactRecord = isRecord(contactValue) ? contactValue : null

  const values = new Map<string, string>()
  for (const key of CONTACT_ORDER) {
    const nested = asText(contactRecord?.[key])
    const value = nested || asText(data[key])
    if (value) values.set(key, value)
  }

  if (contactRecord) {
    for (const [key, raw] of Object.entries(contactRecord)) {
      if (CONTACT_ORDER.includes(key)) continue
      const value = asText(raw)
      if (!value) continue
      values.set(key, value)
      diagAt(
        rawLines,
        diagnostics,
        key,
        'info',
        'CONTACT_UNKNOWN',
        `未知联系方式 ${key}，已作为自定义项显示`,
      )
    }
  }

  const contacts: ContactItem[] = []
  for (const key of CONTACT_ORDER) {
    const value = values.get(key)
    if (value) contacts.push(makeContact(key, value))
  }
  for (const [key, value] of values) {
    if (CONTACT_ORDER.includes(key)) continue
    contacts.push(makeContact(key, value))
  }

  return { name, title, contacts, avatar }
}

function makeContact(key: string, value: string): ContactItem {
  const label = CONTACT_LABELS[key] ?? key
  let href: string | undefined
  if (key === 'email' && value.includes('@')) {
    href = `mailto:${value}`
  } else if (key === 'phone') {
    const digits = value.replace(/[^\d+]/g, '')
    if (digits) href = `tel:${digits}`
  } else {
    href = toHttpUrl(value)
  }
  return href ? { key, label, value, href } : { key, label, value }
}

function toHttpUrl(value: string): string | undefined {
  if (/^https?:\/\//i.test(value)) return value
  if (/^mailto:|^tel:/i.test(value)) return value
  if (!/\s/.test(value) && /[./]/.test(value)) return `https://${value}`
  return undefined
}

function normalizeAccent(value: string): string | null {
  if (!ACCENT_RE.test(value)) return null
  if (value.length === 4) {
    return ('#' + value.slice(1).split('').map((ch) => ch + ch).join('')).toLowerCase()
  }
  return value.toLowerCase()
}

function parseBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  const text = asText(value).toLowerCase()
  if (text === 'true' || text === 'yes' || text === 'on' || text === '1') return true
  if (text === 'false' || text === 'no' || text === 'off' || text === '0') return false
  return null
}

function pick(record: Record<string, unknown>, camelKey: string, snakeKey: string): unknown {
  return record[camelKey] ?? record[snakeKey]
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function diag(
  diagnostics: Diagnostic[],
  line: number,
  severity: Severity,
  code: string,
  message: string,
): void {
  diagnostics.push({ line, severity, code, message })
}

function diagAt(
  rawLines: string[],
  diagnostics: Diagnostic[],
  key: string,
  severity: Severity,
  code: string,
  message: string,
): void {
  const index = rawLines.findIndex((line) => new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`).test(line))
  diag(diagnostics, index >= 0 ? index + 2 : 1, severity, code, message)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------- 样式回写 ----------

export function patchStyle(source: string, patch: Partial<DocStyle>): string {
  const normalized = normalizeSource(source)
  const read = readFrontmatter(normalized)
  if (read.diagnostics.some((item) => item.code === 'FM_YAML')) {
    throw new Error('frontmatter 有语法错误，无法写入样式')
  }

  const next: DocStyle = { ...read.style, ...patch }
  const block = styleBlock(next)

  if (!read.fm) {
    const body = normalized.replace(/^\n+/, '')
    return `---\n${block.join('\n')}\n---\n\n${body}`
  }

  const lines = normalized.split('\n')
  const closingIndex = read.fm.endLine - 1
  const styleIndex = findTopLevelKey(lines, 'style', closingIndex)
  if (styleIndex >= 0) {
    const end = blockEnd(lines, styleIndex, closingIndex)
    lines.splice(styleIndex, end - styleIndex, ...block)
  } else {
    lines.splice(closingIndex, 0, ...block)
  }

  const result = lines.join('\n')
  if (readFrontmatter(result).diagnostics.some((item) => item.code === 'FM_YAML')) {
    throw new Error('写入样式后 frontmatter 校验失败，已取消修改')
  }
  return result
}

export function patchAvatar(source: string, relativePath: string): string {
  const normalized = normalizeSource(source)
  const read = readFrontmatter(normalized)
  if (read.diagnostics.some((item) => item.code === 'FM_YAML')) {
    throw new Error('frontmatter 有语法错误，无法写入头像')
  }

  const line = `avatar: ${JSON.stringify(relativePath)}`

  if (!read.fm) {
    const body = normalized.replace(/^\n+/, '')
    return `---\n${line}\n---\n\n${body}`
  }

  const lines = normalized.split('\n')
  const closingIndex = read.fm.endLine - 1
  const avatarIndex = findTopLevelKey(lines, 'avatar', closingIndex)
  if (avatarIndex >= 0) {
    const end = blockEnd(lines, avatarIndex, closingIndex)
    lines.splice(avatarIndex, end - avatarIndex, line)
  } else {
    lines.splice(closingIndex, 0, line)
  }

  const result = lines.join('\n')
  if (readFrontmatter(result).diagnostics.some((item) => item.code === 'FM_YAML')) {
    throw new Error('写入头像后 frontmatter 校验失败，已取消修改')
  }
  return result
}

export interface IdentityInsertResult {
  source: string
  line: number
  column: number
}

export function ensureIdentity(source: string): IdentityInsertResult {
  const normalized = normalizeSource(source)
  const read = readFrontmatter(normalized)
  if (read.diagnostics.some((item) => item.code === 'FM_YAML' || item.code === 'FM_UNCLOSED')) {
    throw new Error('frontmatter 有语法错误，请先修复')
  }

  const nameLine = 'name: '
  const titleLine = 'title: '
  const contactLines = ['contact:', '  phone: ""', '  email: ""', '  location: ""']

  if (!read.fm) {
    const body = normalized.replace(/^\n+/, '')
    const result = `---\n${nameLine}\n${titleLine}\n${contactLines.join('\n')}\n---\n\n${body}`
    return { source: result, line: 2, column: nameLine.length + 1 }
  }

  const lines = normalized.split('\n')
  const closingIndex = read.fm.endLine - 1
  const hasName = lines
    .slice(1, closingIndex)
    .some((line) => /^name\s*:/.test(line))
  const hasTitle = lines
    .slice(1, closingIndex)
    .some((line) => /^title\s*:/.test(line))
  const hasContact = lines
    .slice(1, closingIndex)
    .some((line) => /^contact\s*:/.test(line))

  let nameIndex = lines.findIndex(
    (line, index) => index > 0 && index < closingIndex && /^name\s*:/.test(line),
  )

  const inserts: string[] = []
  if (!hasName) inserts.push(nameLine)
  if (!hasTitle) inserts.push(titleLine)
  if (!hasContact) inserts.push(...contactLines)

  if (inserts.length > 0) {
    lines.splice(closingIndex, 0, ...inserts)
    if (!hasName) nameIndex = closingIndex
  }

  const result = lines.join('\n')
  if (readFrontmatter(result).diagnostics.some((item) => item.code === 'FM_YAML')) {
    throw new Error('写入个人信息后 frontmatter 校验失败，已取消修改')
  }

  if (nameIndex < 0) return { source: result, line: 1, column: 1 }
  const nameText = lines[nameIndex]
  const colon = nameText.indexOf(':')
  let valueStart = colon >= 0 ? colon + 1 : 0
  while (valueStart < nameText.length && nameText[valueStart] === ' ') valueStart++
  return { source: result, line: nameIndex + 1, column: valueStart + 1 }
}

function styleBlock(style: DocStyle): string[] {
  return [
    'style:',
    `  template: ${style.template}`,
    `  accent: "${style.accent}"`,
    `  font_size: ${style.fontSize}`,
    `  spacing: ${style.spacing}`,
    `  auto_fit: ${style.autoFit ? 'true' : 'false'}`,
  ]
}

function findTopLevelKey(lines: string[], key: string, endExclusive: number): number {
  const pattern = new RegExp(`^${escapeRegExp(key)}\\s*:`)
  for (let i = 1; i < endExclusive; i++) {
    if (pattern.test(lines[i])) return i
  }
  return -1
}

function blockEnd(lines: string[], start: number, endExclusive: number): number {
  let i = start + 1
  while (i < endExclusive) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    if (/^[ \t]/.test(line)) {
      i++
      continue
    }
    break
  }
  return i
}