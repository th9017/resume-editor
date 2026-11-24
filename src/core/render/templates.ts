import baseCss from './styles/base.css?raw'
import classicCss from './styles/classic.css?raw'
import compactCss from './styles/compact.css?raw'
import minimalCss from './styles/minimal.css?raw'
import sidebarCss from './styles/sidebar.css?raw'
import timelineCss from './styles/timeline.css?raw'
import type { TemplateId } from '../types'

export interface TemplateDef {
  id: TemplateId
  name: string
  twoColumn: boolean
  defaultSide: Set<string>
  css: string
}

export const TEMPLATE_LIST: TemplateDef[] = [
  {
    id: 'classic',
    name: '经典单栏',
    twoColumn: false,
    defaultSide: new Set<string>(),
    css: [baseCss, classicCss].join('\n'),
  },
  {
    id: 'sidebar',
    name: '双栏侧栏',
    twoColumn: true,
    defaultSide: new Set(['skills', 'education', 'awards']),
    css: [baseCss, sidebarCss].join('\n'),
  },
  {
    id: 'compact',
    name: '紧凑型',
    twoColumn: false,
    defaultSide: new Set<string>(),
    css: [baseCss, compactCss].join('\n'),
  },
  {
    id: 'timeline',
    name: '时间线',
    twoColumn: false,
    defaultSide: new Set<string>(),
    css: [baseCss, timelineCss].join('\n'),
  },
  {
    id: 'minimal',
    name: '极简留白',
    twoColumn: false,
    defaultSide: new Set<string>(),
    css: [baseCss, minimalCss].join('\n'),
  },
]

export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATE_LIST.find((template) => template.id === id) ?? TEMPLATE_LIST[0]
}

export function templateName(id: TemplateId): string {
  return getTemplate(id).name
}