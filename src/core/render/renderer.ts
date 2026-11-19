import MarkdownIt from 'markdown-it'
import type { DocStyle, ResumeDoc, ResumeItem, ResumeSection } from '../types'
import { escapeHtml, isSafeImageSrc, isSafeLink } from './escape'
import type { TemplateDef } from './templates'

export interface RenderContext {
  template: TemplateDef
  fit?: number
  stacked?: boolean
  resolveImage?: (src: string) => string
}

interface RenderEnv {
  resolveImage?: (src: string) => string
  [key: string]: unknown
}

interface FieldLayout {
  lead: string[]
  meta: string[]
  sub: string[]
}

interface RenderedSection {
  html: string
  placement: 'main' | 'side'
}

const FIELD_LAYOUT: Record<string, FieldLayout> = {
  experience: {
    lead: ['company', 'role'],
    meta: ['period', 'location'],
    sub: ['stack', 'link'],
  },
  projects: {
    lead: ['name', 'role'],
    meta: ['period'],
    sub: ['stack', 'link'],
  },
  education: {
    lead: ['school', 'major'],
    meta: ['period', 'location'],
    sub: ['degree', 'gpa'],
  },
  awards: {
    lead: ['title'],
    meta: ['date'],
    sub: ['issuer', 'link'],
  },
}

const FIELD_LABELS: Record<string, string> = {
  company: '公司',
  role: '职位',
  period: '时间',
  location: '地点',
  stack: '技术栈',
  link: '链接',
  name: '名称',
  school: '学校',
  major: '专业',
  degree: '学历',
  gpa: '绩点',
  title: '标题',
  issuer: '颁发方',
  date: '日期',
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
})

md.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  const token = tokens[index]
  const href = String(token.attrGet('href') ?? '')
  if (!isSafeLink(href)) {
    token.attrSet('href', '')
    token.attrSet('class', 'rv-link-invalid')
  } else {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noreferrer noopener')
  }
  return self.renderToken(tokens, index, options)
}

md.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index]
  const raw = String(token.attrGet('src') ?? '')
  const resolve = (env as RenderEnv | undefined)?.resolveImage
  const resolved = resolve ? resolve(raw) : raw
  if (!isSafeImageSrc(resolved)) {
    const alt = escapeHtml(token.content || '图片')
    return `<span class="rv-img-missing" role="img" aria-label="${alt}">[图片缺失]</span>`
  }
  token.attrSet('src', resolved)
  token.attrSet('alt', token.content || '')
  return self.renderToken(tokens, index, options)
}

export function renderResume(doc: ResumeDoc, context: RenderContext): string {
  const env: RenderEnv = { resolveImage: context.resolveImage }
  const template = context.template
  const fit = context.fit ?? 1
  const stacked = Boolean(context.stacked)
  const classes = ['rv', `rv--${template.id}`, `rv--spacing-${doc.style.spacing}`]
  if (template.twoColumn && !stacked) classes.push('rv--single')
  if (stacked) classes.push('rv--stack')

  const identity = renderIdentity(doc, env)
  const preamble = doc.preamble
    ? `<section class="rv-section rv-section--preamble">${renderMarkdown(doc.preamble, env)}</section>`
    : ''
  const sections = doc.sections
    .map((section) => renderSection(section, template, env))
    .filter((section) => section.html !== '')
  const main = sections
    .filter((section) => section.placement === 'main')
    .map((section) => section.html)
    .join('')
  const side = sections
    .filter((section) => section.placement === 'side')
    .map((section) => section.html)
    .join('')
  const all = sections.map((section) => section.html).join('')
  const attribute = `class="${classes.join(' ')}" style="${styleVars(doc.style, fit)}"`

  if (template.twoColumn && !stacked) {
    return `<article ${attribute}><div class="rv-grid"><aside class="rv-side">${identity}${side}</aside><main class="rv-main">${preamble}${main}</main></div></article>`
  }

  return `<article ${attribute}><header class="rv-header">${identity}</header><main class="rv-main">${preamble}${stacked ? all : main}</main></article>`
}

export function styleVars(style: DocStyle, fit = 1): string {
  const accent = /^#[0-9a-f]{6}$/i.test(style.accent) ? style.accent : '#2563eb'
  const base = Math.min(12, Math.max(8.5, Number.isFinite(style.fontSize) ? style.fontSize : 10.5))
  const fitValue = Math.min(1, Math.max(0.8, Number.isFinite(fit) ? fit : 1))
  return [
    `--rv-accent: ${accent}`,
    `--rv-accent-soft: ${softColor(accent)}`,
    `--rv-base: ${base}pt`,
    `--rv-fit: ${Math.round(fitValue * 1000) / 1000}`,
  ].join('; ') + ';'
}

function renderIdentity(doc: ResumeDoc, env: RenderEnv): string {
  const name = doc.identity.name || '未命名简历'
  const initial = Array.from(name.trim())[0] ?? '简'
  const avatarRaw = doc.identity.avatar
  const avatarSrc = avatarRaw ? (env.resolveImage?.(avatarRaw) ?? avatarRaw) : ''
  const avatar =
    avatarSrc && isSafeImageSrc(avatarSrc)
      ? `<img class="rv-avatar-img" src="${escapeHtml(avatarSrc)}" alt="">`
      : `<span class="rv-avatar-initial">${escapeHtml(initial)}</span>`
  const title = doc.identity.title
    ? `<div class="rv-title">${escapeHtml(doc.identity.title)}</div>`
    : ''
  const contacts = doc.identity.contacts
    .map((contact) => {
      const value =
        contact.href && isSafeLink(contact.href)
          ? `<a href="${escapeHtml(contact.href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(contact.value)}</a>`
          : escapeHtml(contact.value)
      return `<li><span class="rv-contact-label">${escapeHtml(contact.label)}</span><span class="rv-contact-value">${value}</span></li>`
    })
    .join('')

  return `<div class="rv-identity"><div class="rv-avatar">${avatar}</div><div class="rv-heading"><h1 class="rv-name">${escapeHtml(name)}</h1>${title}<ul class="rv-contact">${contacts}</ul></div></div>`
}

function renderSection(
  section: ResumeSection,
  template: TemplateDef,
  env: RenderEnv,
): RenderedSection {
  const placement = resolvePlacement(section, template)
  const hasContent = section.body.trim() !== '' || section.items.length > 0
  if (!hasContent) return { html: '', placement }

  const title = `<h2 class="rv-section-title"><span>${escapeHtml(section.title)}</span></h2>`
  const body = section.body
    ? `<div class="rv-section-body">${renderMarkdown(section.body, env)}</div>`
    : ''
  const items = section.items
    .map((item) => renderItem(section.type, item, env))
    .filter(Boolean)
    .join('')
  const itemsHtml = items ? `<div class="rv-items">${items}</div>` : ''
  return {
    html: `<section class="rv-section" data-type="${escapeHtml(section.type)}">${title}${body}${itemsHtml}</section>`,
    placement,
  }
}

function resolvePlacement(section: ResumeSection, template: TemplateDef): 'main' | 'side' {
  if (!template.twoColumn) return 'main'
  if (section.placement === 'side' || section.placement === 'main') return section.placement
  return template.defaultSide.has(section.type) ? 'side' : 'main'
}

function renderItem(type: string, item: ResumeItem, env: RenderEnv): string {
  const layout = layoutFor(type, item.fields)
  const used = new Set([...layout.lead, ...layout.meta, ...layout.sub])
  const extras = Object.keys(item.fields).filter((key) => !used.has(key))

  const lead = layout.lead
    .map((key) => fieldSpan(key, item.fields[key], env))
    .filter(Boolean)
    .join('')
  const meta = layout.meta
    .map((key) => fieldSpan(key, item.fields[key], env))
    .filter(Boolean)
    .join('')
  const subParts = layout.sub.map((key) => fieldSpan(key, item.fields[key], env))
  for (const key of extras) {
    const value = item.fields[key]
    if (!value) continue
    subParts.push(
      `<span class="rv-field rv-field-extra" data-field="${escapeHtml(key)}">${escapeHtml(FIELD_LABELS[key] ?? key)}: ${renderInline(value, env)}</span>`,
    )
  }
  const sub = subParts.filter(Boolean).join('')
  const body = item.body ? `<div class="rv-item-body">${renderMarkdown(item.body, env)}</div>` : ''

  const head =
    lead || meta
      ? `<header class="rv-item-head">${lead ? `<div class="rv-item-lead">${lead}</div>` : '<span class="rv-item-lead"></span>'}${meta ? `<div class="rv-item-meta">${meta}</div>` : ''}</header>`
      : ''
  const subHtml = sub ? `<div class="rv-item-sub">${sub}</div>` : ''
  if (!head && !subHtml && !body) return ''
  return `<article class="rv-item">${head}${subHtml}${body}</article>`
}

function layoutFor(type: string, fields: Record<string, string>): FieldLayout {
  const known = FIELD_LAYOUT[type]
  if (known) return known
  const keys = Object.keys(fields)
  const metaKeys = keys.filter((key) => ['period', 'date', 'location'].includes(key))
  const leadKeys = keys.filter((key) => !metaKeys.includes(key)).slice(0, 2)
  const subKeys = keys.filter((key) => !metaKeys.includes(key) && !leadKeys.includes(key))
  return { lead: leadKeys, meta: metaKeys, sub: subKeys }
}

function fieldSpan(key: string, value: string | undefined, env: RenderEnv): string {
  if (!value) return ''
  return `<span class="rv-field" data-field="${escapeHtml(key)}">${renderInline(value, env)}</span>`
}

function renderMarkdown(input: string, env: RenderEnv): string {
  if (!input.trim()) return ''
  return md.render(input, env as never)
}

function renderInline(input: string, env: RenderEnv): string {
  if (!input.trim()) return ''
  return md.renderInline(input, env as never)
}

function softColor(accent: string): string {
  const hex = accent.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#eff4ff'
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * 0.9))
  return '#' + mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')
}