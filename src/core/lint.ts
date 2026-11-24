import { SECTION_META } from './types'
import type { ResumeDoc, ResumeItem, ResumeSection } from './types'

export type LintSeverity = 'error' | 'warn' | 'info'

export interface LintIssue {
  code: string
  severity: LintSeverity
  message: string
  /** -1 表示基本信息，其余为 doc.sections 下标，供面板跳转 */
  sectionIndex: number
  sectionTitle: string
}

const ITEMIZED = ['experience', 'projects', 'education', 'awards']
const QUANTIFIED = ['experience', 'projects']
const CJK = /[㐀-䶿一-鿿぀-ヿ]/

function sectionLabel(section: ResumeSection, index: number): string {
  return section.title.trim() || SECTION_META[section.type]?.label || `章节 ${index + 1}`
}

function bulletLines(item: ResumeItem): string[] {
  return item.body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+\S/.test(line))
    .map((line) => line.replace(/^[-*+]\s+/, ''))
}

/** 从 2022.06 / 2022-6 / 2022年6月 / 2022 中取出可比较的月份序号 */
function startMonth(period: string): number | null {
  const match = /(20\d{2})\s*[年./-]\s*(\d{1,2})?/.exec(period)
  if (!match) return null
  const year = Number(match[1])
  const month = match[2] ? Number(match[2]) : 1
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return year * 12 + month
}

function issue(
  code: string,
  severity: LintSeverity,
  message: string,
  sectionIndex: number,
  sectionTitle: string,
): LintIssue {
  return { code, severity, message, sectionIndex, sectionTitle }
}

function checkIdentity(doc: ResumeDoc): LintIssue[] {
  const out: LintIssue[] = []
  const contacts = doc.identity.contacts
  const value = (key: string) => contacts.find((item) => item.key === key)?.value.trim() ?? ''

  if (!doc.identity.name.trim()) {
    out.push(issue('NAME_MISSING', 'warn', '未填写姓名，简历抬头会显示"未命名简历"', -1, '基本信息'))
  }
  const email = value('email')
  const phone = value('phone')
  if (!email && !phone) {
    out.push(issue('CONTACT_NONE', 'error', '既没有邮箱也没有电话，HR 无法联系你', -1, '基本信息'))
  } else if (!email) {
    out.push(issue('EMAIL_MISSING', 'warn', '缺少邮箱', -1, '基本信息'))
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    out.push(issue('EMAIL_FORMAT', 'warn', `邮箱格式可疑：${email}`, -1, '基本信息'))
  }
  if (!email && phone) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7) {
      out.push(issue('PHONE_FORMAT', 'warn', `电话位数偏少：${phone}`, -1, '基本信息'))
    }
  }
  return out
}

function checkSection(
  section: ResumeSection,
  index: number,
): LintIssue[] {
  const out: LintIssue[] = []
  const title = sectionLabel(section, index)
  const hasBody = section.body.trim() !== ''
  const hasItems = section.items.some(
    (item) =>
      Object.values(item.fields).some((value) => value.trim() !== '') || item.body.trim() !== '',
  )

  if (!hasBody && !hasItems) {
    out.push(issue('SECTION_EMPTY', 'warn', `「${title}」是空章节，导出 PDF 时不会出现在页面上`, index, title))
    return out
  }

  if (ITEMIZED.includes(section.type)) {
    out.push(...checkItems(section, index, title))
  }

  if (QUANTIFIED.includes(section.type) || section.type === 'skills') {
    out.push(...checkBullets(section, index, title))
  }

  if (CJK.test(section.body)) {
    const mixed = countMixedPunctuation(section.body)
    if (mixed > 0) {
      out.push(
        issue('PUNCT_MIX', 'info', `「${title}」正文有 ${mixed} 处中文后紧跟半角标点，建议改用全角`, index, title),
      )
    }
  }
  return out
}

function checkItems(section: ResumeSection, index: number, title: string): LintIssue[] {
  const out: LintIssue[] = []
  const months: (number | null)[] = []
  let missingPeriod = 0

  for (const item of section.items) {
    const used = Object.values(item.fields).some((value) => value.trim() !== '') || item.body.trim() !== ''
    if (!used) continue
    const period = item.fields.period ?? item.fields.date ?? ''
    if (!period.trim()) missingPeriod += 1
    months.push(startMonth(period))
  }

  if (missingPeriod > 0) {
    out.push(issue('PERIOD_MISSING', 'info', `「${title}」有 ${missingPeriod} 个条目没写时间`, index, title))
  }

  let outOfOrder = 0
  for (let i = 1; i < months.length; i += 1) {
    const previous = months[i - 1]
    const current = months[i]
    if (previous == null || current == null) continue
    if (current > previous) outOfOrder += 1
  }
  if (outOfOrder > 0) {
    out.push(
      issue('ORDER_NOT_DESC', 'warn', `「${title}」时间不是倒序，最近的经历应放在最前面`, index, title),
    )
  }

  for (const item of section.items) {
    for (const key of ['link', 'website']) {
      const value = (item.fields[key] ?? '').trim()
      if (value && !/^(https?:\/\/|www\.)/i.test(value) && !value.includes('/')) {
        out.push(issue('LINK_FORMAT', 'info', `「${title}」的链接像不是网址：${value}`, index, title))
      }
    }
  }
  return out
}

function checkBullets(section: ResumeSection, index: number, title: string): LintIssue[] {
  const out: LintIssue[] = []
  const lines = section.items.flatMap(bulletLines)
  if (!lines.length) {
    if (QUANTIFIED.includes(section.type)) {
      out.push(issue('NO_BULLETS', 'info', `「${title}」没有分条要点，建议拆成 2-4 条成果`, index, title))
    }
    return out
  }

  const plain = lines.filter((line) => !/\d/.test(line))
  if (plain.length > 0 && plain.length === lines.length) {
    out.push(issue('NOT_QUANTIFIED', 'info', `「${title}」的要点都没有数字，尽量量化成果`, index, title))
  } else if (plain.length >= 2) {
    out.push(
      issue('NOT_QUANTIFIED_SOME', 'info', `「${title}」有 ${plain.length} 条要点没有量化数据`, index, title),
    )
  }

  const long = lines.filter((line) => Array.from(line).length > 60)
  if (long.length > 0) {
    out.push(issue('BULLET_LONG', 'info', `「${title}」有 ${long.length} 条要点超过 60 字，可拆短`, index, title))
  }

  const firstPerson = lines.filter((line) => /^(我们|我)/.test(line.trim()))
  if (firstPerson.length > 0) {
    out.push(
      issue('FIRST_PERSON', 'info', `「${title}」有 ${firstPerson.length} 条要点用"我"开头，简历惯用无主语句式`, index, title),
    )
  }
  return out
}

function countMixedPunctuation(text: string): number {
  let count = 0
  const characters = Array.from(text)
  for (let i = 1; i < characters.length; i += 1) {
    const previous = characters[i - 1]
    const current = characters[i]
    if (!CJK.test(previous)) continue
    if (current === ',' || current === ';' || current === ':' || current === '!' || current === '?') count += 1
    if (current === '.' && !/\d/.test(characters[i + 1] ?? '') && !/[a-zA-Z]/.test(previous)) count += 1
  }
  return count
}

export function lintResume(doc: ResumeDoc): LintIssue[] {
  const out: LintIssue[] = [...checkIdentity(doc)]
  doc.sections.forEach((section, index) => out.push(...checkSection(section, index)))
  return out
}

export const LINT_SEVERITY_LABEL: Record<LintSeverity, string> = {
  error: '必须处理',
  warn: '建议处理',
  info: '可选优化',
}
