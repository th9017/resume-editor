export type TemplateId = 'classic' | 'sidebar' | 'compact'
export type Spacing = 'compact' | 'normal' | 'relaxed'
export type Placement = 'auto' | 'main' | 'side'
export type Severity = 'error' | 'warn' | 'info'

export interface DocStyle {
  template: TemplateId
  accent: string
  fontSize: number
  spacing: Spacing
  autoFit: boolean
}

export interface ContactItem {
  key: string
  label: string
  value: string
  href?: string
}

export interface ResumeIdentity {
  name: string
  title: string
  contacts: ContactItem[]
  avatar: string
}

export interface ResumeItem {
  fields: Record<string, string>
  body: string
  line: number
  endLine: number
}

export interface ResumeSection {
  type: string
  title: string
  placement: Placement
  body: string
  items: ResumeItem[]
  line: number
  endLine: number
}

export interface Diagnostic {
  line: number
  severity: Severity
  code: string
  message: string
}

export interface FmInfo {
  raw: string
  startLine: number
  endLine: number
  data: Record<string, unknown> | null
}

export interface ResumeDoc {
  identity: ResumeIdentity
  style: DocStyle
  preamble: string
  sections: ResumeSection[]
  diagnostics: Diagnostic[]
  source: string
  frontmatter: FmInfo | null
}

export const DEFAULT_STYLE: DocStyle = {
  template: 'classic',
  accent: '#2563eb',
  fontSize: 10.5,
  spacing: 'normal',
  autoFit: true,
}

export const SECTION_META: Record<string, { label: string; fields: string[]; itemized: boolean }> = {
  summary: { label: '个人简介', fields: [], itemized: false },
  experience: {
    label: '工作经历',
    fields: ['company', 'role', 'period', 'location', 'stack', 'link'],
    itemized: true,
  },
  projects: {
    label: '项目经历',
    fields: ['name', 'role', 'period', 'stack', 'link'],
    itemized: true,
  },
  education: {
    label: '教育背景',
    fields: ['school', 'degree', 'major', 'period', 'location', 'gpa'],
    itemized: true,
  },
  skills: { label: '专业技能', fields: [], itemized: false },
  awards: { label: '荣誉奖项', fields: ['title', 'issuer', 'date', 'link'], itemized: true },
}

export const SECTION_OPTIONS = Object.entries(SECTION_META).map(([type, meta]) => ({
  type,
  label: meta.label,
}))

export const CONTACT_LABELS: Record<string, string> = {
  phone: '电话',
  email: '邮箱',
  location: '所在地',
  website: '网站',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  blog: '博客',
  wechat: '微信',
}

export const CONTACT_ORDER = ['phone', 'email', 'location', 'website', 'github', 'linkedin', 'blog', 'wechat']