import { isZip, readZipText } from './zip'

export interface DocxParagraph {
  /** 1~8 表示 Word 大纲级别，0 表示正文 */
  level: number
  bullet: boolean
  boldOnly: boolean
  text: string
}

interface DocxStyle {
  name: string
  outline: number
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

const PARAGRAPH = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p(?:\s[^>]*)?\/>/g
const RUN = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>|<w:r(?:\s[^>]*)?\/>/g
const RUN_PART =
  /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab(?:\s[^>]*)?\/>|<w:br(?:\s[^>]*)?\/>|<w:noBreakHyphen(?:\s[^>]*)?\/>/g
const STYLE = /<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g
const PUNCT_TAIL = /[。，、；,;.!?？!：:]$/
const NAME_HINT = /[：:，,。.;；|、]/

function codePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : ''
}

function decodeEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (all, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return codePoint(Number.parseInt(body.slice(2), 16))
    }
    if (body.startsWith('#')) return codePoint(Number(body.slice(1)))
    return ENTITIES[body] ?? all
  })
}

function isBold(fragment: string): boolean {
  return /<w:b\s*\/>|<w:b\s[^>]*w:val="(?:1|true|on)"/i.test(fragment)
}

function firstMatch(fragment: string, pattern: RegExp): string | null {
  const match = pattern.exec(fragment)
  return match ? match[1] : null
}

export function parseDocxStyles(stylesXml: string): Map<string, DocxStyle> {
  const styles = new Map<string, DocxStyle>()
  for (const [, styleId, body] of stylesXml.matchAll(STYLE)) {
    const outline = firstMatch(body, /<w:outlineLvl w:val="(\d+)"/)
    styles.set(styleId, {
      name: firstMatch(body, /<w:name w:val="([^"]+)"/) ?? '',
      outline: outline === null ? -1 : Number(outline),
    })
  }
  return styles
}

function headingFromStyle(styleId: string | null, styles: Map<string, DocxStyle>): number {
  if (!styleId) return 0
  const style = styles.get(styleId)
  if (style && style.outline >= 0) return Math.min(style.outline + 1, 8)
  const named = /^(?:heading|标题)\s*([1-8])/i.exec(style?.name ?? styleId)
  if (named) return Number(named[1])
  const direct = /^Heading([1-8])$/i.exec(styleId)
  return direct ? Number(direct[1]) : 0
}

function paragraphText(inner: string): { text: string; boldOnly: boolean } {
  let text = ''
  let bold = true
  let hasText = false
  for (const run of inner.matchAll(RUN)) {
    const body = run[1] ?? ''
    const runBold = isBold(body)
    for (const part of body.matchAll(RUN_PART)) {
      if (part[0].startsWith('<w:tab')) {
        text += ' '
        continue
      }
      if (part[0].startsWith('<w:br')) {
        text += ' '
        continue
      }
      if (part[0].startsWith('<w:noBreakHyphen')) {
        text += '-'
        continue
      }
      const value = decodeEntities(part[1] ?? '')
      if (!value) continue
      hasText = true
      if (!runBold) bold = false
      text += value
    }
  }
  return { text: text.trim(), boldOnly: hasText && bold }
}

export function readDocxParagraphs(
  documentXml: string,
  styles: Map<string, DocxStyle> = new Map(),
): DocxParagraph[] {
  const paragraphs: DocxParagraph[] = []
  for (const match of documentXml.matchAll(PARAGRAPH)) {
    const inner = match[1] ?? ''
    if (!inner) continue
    const props = firstMatch(inner, /<w:pPr>([\s\S]*?)<\/w:pPr>/) ?? ''
    const outline = firstMatch(props, /<w:outlineLvl w:val="(\d+)"/)
    const level =
      outline !== null
        ? Math.min(Number(outline) + 1, 8)
        : headingFromStyle(firstMatch(props, /<w:pStyle w:val="([^"]+)"/), styles)
    const { text, boldOnly } = paragraphText(inner)
    if (!text) continue
    paragraphs.push({ level, bullet: /<w:numPr>/.test(props), boldOnly, text })
  }
  return paragraphs
}

function isNameLike(text: string): boolean {
  if (text.length === 0 || text.length > 12) return false
  if (NAME_HINT.test(text) || /\d/.test(text)) return false
  return !/^(?:个人简历|简历|resume|cv|personal resume)$/i.test(text)
}

/** Word 的大纲级别是相对的：最浅一级映射成章节标题，下一级映射成条目标题 */
export function docxParagraphsToMarkdown(paragraphs: DocxParagraph[]): string {
  const levels = [...new Set(paragraphs.filter((entry) => entry.level > 0).map((entry) => entry.level))]
  const shallowest = levels.length ? Math.min(...levels) : 0
  const useBoldFallback = levels.length === 0
  const lines: string[] = []
  let seenHeading = false

  for (const paragraph of paragraphs) {
    if (paragraph.bullet) {
      lines.push(`- ${paragraph.text}`)
      continue
    }
    let level = paragraph.level
    if (
      useBoldFallback &&
      level === 0 &&
      paragraph.boldOnly &&
      paragraph.text.length <= 24 &&
      !PUNCT_TAIL.test(paragraph.text)
    ) {
      level = shallowest || 2
    }
    if (level > 0) {
      seenHeading = true
      const depth = level === (shallowest || level) ? 2 : 3
      lines.push(`${'#'.repeat(depth)} ${paragraph.text}`)
      continue
    }
    if (!seenHeading && lines.length === 0 && isNameLike(paragraph.text)) {
      lines.push(`# ${paragraph.text}`)
      continue
    }
    lines.push(paragraph.text)
  }
  return lines.join('\n\n')
}

/** 走「DOCX → 普通 Markdown → 应用容器格式」两步，复用已有的 Markdown 导入器 */
export async function docxToMarkdown(data: Uint8Array): Promise<string> {
  if (!isZip(data)) throw new Error('这不是 .docx 文件；老的 .doc 格式请先用 Word 另存为 .docx')
  const documentXml = await readZipText(data, 'word/document.xml')
  if (!documentXml) throw new Error('文件里没有 word/document.xml，可能不是 Word 文档')
  const stylesXml = (await readZipText(data, 'word/styles.xml')) ?? ''
  const markdown = docxParagraphsToMarkdown(
    readDocxParagraphs(documentXml, parseDocxStyles(stylesXml)),
  )
  if (!markdown.trim()) throw new Error('DOCX 里没有可导入的文字内容')
  return markdown
}
