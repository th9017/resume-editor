import {
  createBlankItem,
  createBlankSection,
  type DraftItem,
  type DraftSection,
  type ResumeDraft,
} from './draft'
import { serializeDraft } from './draft'
import { DEFAULT_STYLE, SECTION_META, type DocStyle } from './types'

const SECTION_ALIASES: Record<string, string[]> = {
  summary: ['个人简介', '简介', '自我介绍', '关于我', 'about me', 'about', 'summary', 'profile'],
  experience: ['工作经历', '工作经验', '职业经历', '任职经历', '工作履历', 'work experience', 'employment', 'experience'],
  projects: ['项目经历', '项目经验', '主要项目', '项目', 'projects', 'project'],
  education: ['教育背景', '教育经历', '学历', '学习经历', 'education'],
  skills: ['专业技能', '技能特长', '技能', '技术栈', 'technical skills', 'skills'],
  awards: ['荣誉奖项', '获奖情况', '奖项', '荣誉', '证书', 'certificates', 'honors', 'awards'],
}

/** 每种章节的主字段：### 标题文本落到这里 */
const PRIMARY_FIELD: Record<string, string> = {
  experience: 'company',
  projects: 'name',
  education: 'school',
  awards: 'title',
  custom: 'title',
}

function stripFrontmatter(source: string): { frontmatter: string[]; body: string } {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  if (lines[0]?.trim() !== '---') return { frontmatter: [], body: lines.join('\n') }
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (closing < 0) return { frontmatter: [], body: lines.join('\n') }
  return { frontmatter: lines.slice(1, closing), body: lines.slice(closing + 1).join('\n') }
}

function cleanHeading(text: string): string {
  return text.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim()
}

function matchType(heading: string): string {
  const key = heading.trim().toLowerCase()
  for (const [type, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(key)) return type
  }
  return 'custom'
}

function isBullet(line: string): boolean {
  return /^\s*[-*+]\s+\S/.test(line)
}

function bulletText(line: string): string {
  return line.replace(/^\s*[-*+]\s+/, '').trim()
}

export function looksLikePlainMarkdown(source: string): boolean {
  if (!source.trim()) return false
  const { body } = stripFrontmatter(source)
  if (body.includes('::::')) return false
  return /^#{1,3}\s+\S/m.test(body)
}

function nameFromFrontmatter(lines: string[]): string {
  for (const line of lines) {
    const match = /^(?:name|姓名)\s*:\s*(.+)$/i.exec(line.trim())
    if (match) return match[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

function titleFromFrontmatter(lines: string[]): string {
  for (const line of lines) {
    const match = /^(?:title|职位)\s*:\s*(.+)$/i.exec(line.trim())
    if (match) return match[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

function emptyDraft(style?: DocStyle): ResumeDraft {
  return {
    identity: { name: '', title: '', contacts: [], avatar: '' },
    style: { ...(style ?? DEFAULT_STYLE) },
    sections: [],
  }
}

function pushLine(target: { body: string }, line: string): void {
  target.body = target.body ? `${target.body}\n${line}` : line
}

/** 把普通 Markdown 简历映射成应用自身的容器格式 */
export function importPlainMarkdown(source: string): string {
  const { frontmatter, body } = stripFrontmatter(source)
  const draft = emptyDraft()
  draft.identity.name = nameFromFrontmatter(frontmatter)
  draft.identity.title = titleFromFrontmatter(frontmatter)

  let section: DraftSection | null = null
  let item: DraftItem | null = null
  const intro: string[] = []

  const closeItem = (): void => {
    if (section && item) section.items.push(item)
    item = null
  }
  const closeSection = (): void => {
    closeItem()
    if (section) draft.sections.push(section)
    section = null
  }

  for (const raw of body.split('\n')) {
    const line = raw.trimEnd()
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)

    if (heading) {
      const level = heading[1].length
      const text = cleanHeading(heading[2])
      if (level === 1) {
        if (!draft.identity.name) draft.identity.name = text
        continue
      }
      if (level === 2) {
        closeSection()
        const type = matchType(text)
        section = createBlankSection(type, type === 'custom' ? text : SECTION_META[type]?.label ?? text)
        // createBlankSection 会预置一条空条目，导入时由实际内容决定条目数量
        section.items = []
        item = null
        continue
      }
      if (!section) {
        closeSection()
        section = createBlankSection('custom', text)
        section.items = []
      }
      closeItem()
      const primary = PRIMARY_FIELD[section.type]
      const next = createBlankItem(section.type)
      if (primary) next.fields[primary] = text
      else next.fields.title = text
      next.bullets = []
      item = next
      continue
    }

    if (!section) {
      if (line.trim() || intro.length) intro.push(line)
      continue
    }

    if (isBullet(line)) {
      const text = bulletText(line)
      if (section.type === 'skills') {
        if (section.bullets[0] === '') section.bullets = []
        section.bullets.push(text)
      } else if (item) {
        item.bullets.push(text)
      } else {
        if (section.bullets.length === 0 && section.type !== 'summary') {
          item = createBlankItem(section.type)
          item.bullets = [text]
        } else {
          pushLine(section, `- ${text}`)
        }
      }
      continue
    }

    if (!line.trim()) continue

    if (item) {
      item.note = item.note ? `${item.note}\n${line.trim()}` : line.trim()
    } else {
      pushLine(section, line.trim())
    }
  }
  closeSection()

  const introText = intro.join('\n').trim()
  if (introText) {
    const summary = draft.sections.find((entry) => entry.type === 'summary')
    if (summary) summary.body = summary.body ? `${introText}\n\n${summary.body}` : introText
    else {
      const section = createBlankSection('summary')
      section.body = introText
      draft.sections.unshift(section)
    }
  }

  if (!draft.sections.length) {
    const section = createBlankSection('summary')
    section.body = body.trim()
    draft.sections.push(section)
  }

  // 空的占位要点会让序列化写出没有内容的条目
  for (const entry of draft.sections) {
    entry.bullets = entry.bullets.filter((bullet) => bullet.trim() !== '')
    for (const entryItem of entry.items) {
      entryItem.bullets = entryItem.bullets.filter((bullet) => bullet.trim() !== '')
    }
  }
  return serializeDraft(draft)
}
