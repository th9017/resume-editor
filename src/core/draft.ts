import { stringify } from 'yaml'
import { parseResume } from './parser'
import {
  CONTACT_LABELS,
  CONTACT_ORDER,
  CUSTOM_FIELDS,
  SECTION_META,
  type Diagnostic,
  type DocStyle,
  type ResumeDoc,
} from './types'

export interface DraftContact {
  key: string
  label: string
  value: string
}

export interface DraftItem {
  id: string
  fields: Record<string, string>
  bullets: string[]
  note: string
}

export interface DraftSection {
  id: string
  type: string
  title: string
  placement: 'auto' | 'main' | 'side'
  body: string
  bullets: string[]
  items: DraftItem[]
}

export interface ResumeDraft {
  identity: { name: string; title: string; contacts: DraftContact[]; avatar: string }
  style: DocStyle
  sections: DraftSection[]
}

let idSeq = 0

function nextId(prefix: string): string {
  idSeq += 1
  return `${prefix}-${idSeq}`
}

export function fieldKeysFor(type: string): string[] {
  const meta = SECTION_META[type]
  return meta ? [...meta.fields] : [...CUSTOM_FIELDS]
}

export function splitItemBody(body: string): { bullets: string[]; note: string } {
  const bullets: string[] = []
  const noteLines: string[] = []
  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    const match = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (match) bullets.push(match[1]?.trimEnd() ?? '')
    else noteLines.push(line)
  }
  return { bullets, note: noteLines.join('\n').trim() }
}

export function composeItemBody(item: Pick<DraftItem, 'bullets' | 'note'>): string {
  const bullets = item.bullets.map((bullet) => bullet.trim()).filter(Boolean)
  const note = item.note.trim()
  const parts: string[] = []
  if (bullets.length) parts.push(bullets.map((bullet) => `- ${bullet}`).join('\n'))
  if (note) parts.push(note)
  return parts.join('\n\n')
}

function contactHref(key: string, value: string): string | undefined {
  if (key === 'email' && value.includes('@')) return `mailto:${value}`
  if (key === 'phone') {
    const digits = value.replace(/[^\d+]/g, '')
    return digits ? `tel:${digits}` : undefined
  }
  if (/^https?:\/\//i.test(value)) return value
  if (
    ['website', 'github', 'linkedin', 'blog'].includes(key) &&
    !/\s/.test(value) &&
    /[./]/.test(value)
  ) {
    return `https://${value}`
  }
  return undefined
}

function contactsFromDoc(doc: ResumeDoc): DraftContact[] {
  const map = new Map(doc.identity.contacts.map((contact) => [contact.key, contact.value]))
  const contacts: DraftContact[] = []
  for (const key of CONTACT_ORDER) {
    contacts.push({ key, label: CONTACT_LABELS[key] ?? key, value: map.get(key) ?? '' })
    map.delete(key)
  }
  for (const [key, value] of map) {
    contacts.push({ key, label: CONTACT_LABELS[key] ?? key, value })
  }
  return contacts
}

export function docToDraft(doc: ResumeDoc): ResumeDraft {
  return {
    identity: {
      name: doc.identity.name,
      title: doc.identity.title,
      contacts: contactsFromDoc(doc),
      avatar: doc.identity.avatar,
    },
    style: { ...doc.style },
    sections: doc.sections.map((section) => {
      const skills = section.type === 'skills' ? splitItemBody(section.body) : null
      return {
        id: nextId('section'),
        type: section.type,
        title: section.title,
        placement: section.placement,
        body: skills ? skills.note : section.body,
        bullets: skills ? skills.bullets : [],
        items: section.items.map((item) => {
          const split = splitItemBody(item.body)
          return {
            id: nextId('item'),
            fields: { ...item.fields },
            bullets: split.bullets,
            note: split.note,
          }
        }),
      }
    }),
  }
}

function composeSectionBody(section: DraftSection): string {
  const parts: string[] = []
  if (section.body.trim()) parts.push(section.body.trim())
  if (section.type === 'skills' && section.bullets.some((bullet) => bullet.trim())) {
    parts.push(
      section.bullets
        .map((bullet) => bullet.trim())
        .filter(Boolean)
        .map((bullet) => `- ${bullet}`)
        .join('\n'),
    )
  }
  return parts.join('\n\n')
}

export function draftToDoc(draft: ResumeDraft): ResumeDoc {
  return {
    identity: {
      name: draft.identity.name.trim(),
      title: draft.identity.title.trim(),
      contacts: draft.identity.contacts
        .filter((contact) => contact.value.trim())
        .map((contact) => ({
          key: contact.key,
          label: contact.label || CONTACT_LABELS[contact.key] || contact.key,
          value: contact.value.trim(),
          href: contactHref(contact.key, contact.value.trim()),
        })),
      avatar: draft.identity.avatar.trim(),
    },
    style: { ...draft.style },
    preamble: '',
    sections: draft.sections.map((section) => ({
      type: section.type,
      title: section.title.trim() || SECTION_META[section.type]?.label || '自定义章节',
      placement: section.placement,
      body: composeSectionBody(section),
      items: section.items.map((item) => ({
        fields: Object.fromEntries(
          Object.entries(item.fields)
            .map(([key, value]) => [key, value.trim()] as const)
            .filter(([, value]) => value !== ''),
        ),
        body: composeItemBody(item),
        line: 0,
        endLine: 0,
      })),
      line: 0,
      endLine: 0,
    })),
    diagnostics: [],
    source: '',
    frontmatter: null,
  }
}

function oneLine(value: string): string {
  return value.replace(/\s*\n+\s*/g, ' ').trim()
}

function fieldOrder(type: string, fields: Record<string, string>): string[] {
  const keys = fieldKeysFor(type)
  for (const key of Object.keys(fields)) if (!keys.includes(key)) keys.push(key)
  return keys
}

function renderDraftItem(type: string, item: DraftItem): string {
  const lines = ['::: item']
  for (const key of fieldOrder(type, item.fields)) {
    const value = oneLine(item.fields[key] ?? '')
    if (value) lines.push(`${key}: ${value}`)
  }
  const bullets = item.bullets.map(oneLine).filter(Boolean)
  const note = item.note.trim()
  if (bullets.length || note || lines.length === 1) {
    lines.push('---')
    for (const bullet of bullets) lines.push(`- ${bullet}`)
    if (note) {
      if (bullets.length) lines.push('')
      lines.push(note)
    }
  }
  lines.push(':::')
  return lines.join('\n')
}

function renderDraftSection(section: DraftSection): string {
  const title = section.title.trim() || SECTION_META[section.type]?.label || '自定义章节'
  const placement = section.placement === 'auto' ? '' : ` ${section.placement}`
  const lines = [`:::: ${section.type}${placement}`, `## ${title}`, '']
  if (section.type === 'summary') {
    if (section.body.trim()) lines.push(section.body.trim(), '')
  } else if (section.type === 'skills') {
    if (section.body.trim()) lines.push(section.body.trim(), '')
    const bullets = section.bullets.map((bullet) => bullet.trim()).filter(Boolean)
    for (const bullet of bullets) lines.push(`- ${bullet}`)
    if (bullets.length) lines.push('')
  } else {
    if (section.body.trim()) lines.push(section.body.trim(), '')
    for (const item of section.items) lines.push(renderDraftItem(section.type, item), '')
  }
  lines.push('::::')
  return lines.join('\n')
}

export function serializeDraft(draft: ResumeDraft): string {
  const fm: Record<string, unknown> = {}
  if (draft.identity.name.trim()) fm.name = draft.identity.name.trim()
  if (draft.identity.title.trim()) fm.title = draft.identity.title.trim()
  const contacts: Record<string, string> = {}
  for (const contact of draft.identity.contacts) {
    const value = contact.value.trim()
    if (contact.key && value) contacts[contact.key] = value
  }
  if (Object.keys(contacts).length) fm.contact = contacts
  if (draft.identity.avatar.trim()) fm.avatar = draft.identity.avatar.trim()
  fm.style = {
    template: draft.style.template,
    accent: draft.style.accent,
    font_size: draft.style.fontSize,
    spacing: draft.style.spacing,
    auto_fit: draft.style.autoFit,
  }
  const yamlText = stringify(fm, { lineWidth: 0 }).trimEnd()
  const body = draft.sections.map(renderDraftSection).join('\n\n').trimEnd()
  return `---\n${yamlText}\n---\n\n${body}${body ? '\n' : ''}`
}

const KNOWN_FRONTMATTER_KEYS = new Set(['name', 'title', 'contact', 'avatar', 'style'])

export function collectUnsupported(doc: ResumeDoc): Diagnostic[] {
  const diagnostics = [...doc.diagnostics]
  if (doc.frontmatter?.data) {
    for (const key of Object.keys(doc.frontmatter.data)) {
      if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
        diagnostics.push({
          line: 1,
          severity: 'warn',
          code: 'FM_UNKNOWN',
          message: `frontmatter 字段 ${key} 不在表单支持范围内`,
        })
      }
    }
  }
  return diagnostics.sort((a, b) => a.line - b.line)
}

export function analyzeSource(content: string): {
  doc: ResumeDoc
  draft: ResumeDraft
  diagnostics: Diagnostic[]
} {
  const doc = parseResume(content)
  return { doc, draft: docToDraft(doc), diagnostics: collectUnsupported(doc) }
}

export function createBlankItem(type: string): DraftItem {
  return {
    id: nextId('item'),
    fields: Object.fromEntries(fieldKeysFor(type).map((key) => [key, ''] as const)),
    bullets: [''],
    note: '',
  }
}

export function createBlankSection(type: string, title?: string): DraftSection {
  const known = SECTION_META[type]
  return {
    id: nextId('section'),
    type,
    title: title ?? known?.label ?? (type === 'custom' ? '自定义章节' : type),
    placement: 'auto',
    body: '',
    bullets: type === 'skills' ? [''] : [],
    items: type === 'summary' || type === 'skills' ? [] : [createBlankItem(type)],
  }
}