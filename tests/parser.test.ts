import { describe, expect, it } from 'vitest'
import { parseResume } from '../src/core/parser'
import { DEFAULT_STYLE } from '../src/core/types'
import { SHOWCASE_MARKDOWN } from '../src/samples/showcase'

function codes(source: string): string[] {
  return parseResume(source).diagnostics.map((item) => item.code)
}

describe('parseResume', () => {
  it('解析完整示例', () => {
    const doc = parseResume(SHOWCASE_MARKDOWN)
    expect(doc.identity.name).toBe('张一鸣')
    expect(doc.identity.title).toBe('高级前端工程师')
    expect(doc.identity.contacts.length).toBeGreaterThanOrEqual(5)
    expect(doc.style).toEqual(DEFAULT_STYLE)
    expect(doc.sections.map((section) => section.type)).toEqual([
      'summary',
      'experience',
      'projects',
      'education',
      'skills',
      'awards',
    ])
    const experience = doc.sections.find((section) => section.type === 'experience')!
    expect(experience.title).toBe('工作经历')
    expect(experience.items).toHaveLength(2)
    expect(experience.items[0].fields.company).toBe('蓝鲸科技')
    expect(experience.items[0].fields.link).toBe('https://example.com/team')
    expect(experience.items[0].body).toContain('主导桌面端 Markdown 编辑器')
    const education = doc.sections.find((section) => section.type === 'education')!
    expect(education.placement).toBe('side')
    expect(education.items[0].fields.school).toBe('浙江大学')
    expect(doc.diagnostics.filter((item) => item.severity === 'error')).toHaveLength(0)
  })

  it('解析无 frontmatter 的章节与标题', () => {
    const doc = parseResume(':::: summary\n## 简介\nHello\n::::')
    expect(doc.identity.name).toBe('')
    expect(doc.frontmatter).toBeNull()
    expect(doc.sections[0].type).toBe('summary')
    expect(doc.sections[0].title).toBe('简介')
    expect(doc.sections[0].body).toBe('Hello')
    expect(doc.sections[0].line).toBe(1)
    expect(doc.sections[0].endLine).toBe(4)
  })

  it('使用默认标题并解析条目字段与正文', () => {
    const doc = parseResume(':::: experience\n::: item\ncompany: A\nrole: 工程师\n---\n- x\n:::\n::::')
    const section = doc.sections[0]
    expect(section.title).toBe('工作经历')
    expect(section.items[0].fields).toEqual({ company: 'A', role: '工程师' })
    expect(section.items[0].body).toBe('- x')
    expect(section.items[0].line).toBe(2)
    expect(section.items[0].endLine).toBe(7)
  })

  it('条目的 --- 分隔符可省略', () => {
    const doc = parseResume(':::: experience\n::: item\ncompany: A\n\n- x\n:::\n::::')
    expect(doc.sections[0].items[0].fields.company).toBe('A')
    expect(doc.sections[0].items[0].body).toBe('- x')
  })

  it('重复字段后者覆盖并给出警告', () => {
    const doc = parseResume(
      ':::: experience\n::: item\ncompany: A\ncompany: B\n---\n- x\n:::\n::::',
    )
    expect(doc.sections[0].items[0].fields.company).toBe('B')
    expect(codes(':::: experience\n::: item\ncompany: A\ncompany: B\n---\n- x\n:::\n::::')).toContain(
      'FIELD_DUP',
    )
  })

  it('未知字段保留并给出提示', () => {
    const doc = parseResume(':::: experience\n::: item\ncompany: A\nfoo: bar\n---\n:::\n::::')
    expect(doc.sections[0].items[0].fields.foo).toBe('bar')
    expect(doc.diagnostics.some((item) => item.code === 'FIELD_UNKNOWN')).toBe(true)
  })

  it('新条目自动结束上一个条目', () => {
    const source =
      ':::: experience\n::: item\ncompany: A\n---\n- a\n::: item\ncompany: B\n---\n- b\n:::\n::::'
    const doc = parseResume(source)
    expect(doc.sections[0].items).toHaveLength(2)
    expect(doc.sections[0].items[0].body).toBe('- a')
    expect(doc.sections[0].items[1].fields.company).toBe('B')
    expect(codes(source)).toContain('ITEM_IMPLICIT_CLOSE')
  })

  it('章节的 4 冒号闭合围栏会同时结束未闭合条目', () => {
    const source = ':::: experience\n::: item\ncompany: A\n---\n- a\n::::'
    const doc = parseResume(source)
    expect(doc.sections[0].items[0].body).toBe('- a')
    expect(doc.sections[0].endLine).toBe(6)
    expect(codes(source)).toContain('ITEM_IMPLICIT_CLOSE')
  })

  it('短的闭合围栏不会关闭章节', () => {
    const source = ':::: experience\n## x\n:::'
    const doc = parseResume(source)
    expect(codes(source)).toContain('FENCE_MISMATCH')
    expect(codes(source)).toContain('SEC_UNCLOSED')
    expect(doc.sections).toHaveLength(1)
  })

  it('文末自动闭合未闭合的条目与章节', () => {
    const source = ':::: experience\n::: item\ncompany: A\n---\n- a'
    const doc = parseResume(source)
    expect(codes(source)).toContain('ITEM_UNCLOSED')
    expect(codes(source)).toContain('SEC_UNCLOSED')
    expect(doc.sections[0].items[0].endLine).toBe(5)
    expect(doc.sections[0].endLine).toBe(5)
  })

  it('未知章节降级为自定义章节', () => {
    const doc = parseResume(':::: volunteer\n## 志愿经历\n- 帮助他人\n::::')
    expect(doc.sections[0].type).toBe('volunteer')
    expect(doc.sections[0].title).toBe('志愿经历')
    expect(doc.sections[0].body).toBe('- 帮助他人')
    expect(doc.diagnostics.some((item) => item.code === 'SEC_UNKNOWN')).toBe(true)
  })

  it('章节外的条目自动包裹为自定义章节', () => {
    const doc = parseResume('::: item\ncompany: A\n---\n- a\n:::')
    expect(doc.sections).toHaveLength(1)
    expect(doc.sections[0].type).toBe('custom')
    expect(doc.sections[0].items).toHaveLength(1)
    expect(doc.diagnostics.some((item) => item.code === 'ITEM_OUTSIDE')).toBe(true)
  })

  it('代码块中的 ::: 不会被当作容器', () => {
    const source =
      ':::: experience\n## 工作\n::: item\ncompany: A\n---\n```md\n::: 不是闭合\n```\n:::\n::::'
    const doc = parseResume(source)
    expect(doc.sections[0].items[0].body).toContain('::: 不是闭合')
    expect(codes(source)).not.toContain('STRAY_CLOSE')
    expect(codes(source)).not.toContain('ITEM_UNCLOSED')
  })

  it('支持 BOM 与 CRLF', () => {
    const source = '\uFEFF---\r\nname: 李四\r\n---\r\n:::: summary\r\n## 简介\r\n你好\r\n::::'
    const doc = parseResume(source)
    expect(doc.identity.name).toBe('李四')
    expect(doc.sections[0].title).toBe('简介')
    expect(doc.sections[0].body).toBe('你好')
    expect(doc.diagnostics.some((item) => item.severity === 'error')).toBe(false)
  })

  it('解析 frontmatter 的联系方式与样式', () => {
    const source = `---
name: 李四
title: 工程师
contact:
  email: a@b.c
  github: github.com/li
  wechat: li4
style:
  template: sidebar
  accent: "#ABC"
  font_size: 15
  spacing: compact
  auto_fit: false
---
:::: summary
## 简介
Hi
::::`
    const doc = parseResume(source)
    expect(doc.identity.name).toBe('李四')
    expect(doc.identity.contacts[0]).toMatchObject({
      key: 'email',
      href: 'mailto:a@b.c',
    })
    expect(doc.identity.contacts[1]).toMatchObject({
      key: 'github',
      href: 'https://github.com/li',
    })
    expect(doc.identity.contacts[2]).toMatchObject({ key: 'wechat', label: '微信' })
    expect(doc.style).toEqual({
      template: 'sidebar',
      accent: '#aabbcc',
      fontSize: 12,
      spacing: 'compact',
      autoFit: false,
    })
  })

  it('frontmatter YAML 错误不阻断正文', () => {
    const source = '---\nname: [broken\n---\n:::: summary\n## 简介\nHi\n::::'
    const doc = parseResume(source)
    expect(doc.diagnostics.some((item) => item.code === 'FM_YAML')).toBe(true)
    expect(doc.identity.name).toBe('')
    expect(doc.style).toEqual(DEFAULT_STYLE)
    expect(doc.sections[0].body).toBe('Hi')
  })

  it('frontmatter 未闭合时按正文处理', () => {
    const source = '---\nname: X\n:::: summary\n## 简介\nHi\n::::'
    const doc = parseResume(source)
    expect(doc.diagnostics.some((item) => item.code === 'FM_UNCLOSED')).toBe(true)
    expect(doc.identity.name).toBe('')
    expect(doc.sections[0].body).toBe('Hi')
  })

  it('章节外的正文作为 preamble 并给出提示', () => {
    const source = '前言\n\n:::: summary\n## 简介\nHi\n::::'
    const doc = parseResume(source)
    expect(doc.preamble).toBe('前言')
    expect(doc.diagnostics.some((item) => item.code === 'PREAMBLE')).toBe(true)
  })

  it('行号基于完整源文（含 frontmatter）', () => {
    const source =
      '---\nname: X\n---\n:::: experience\n## 工作\n::: item\ncompany: A\n---\n- x\n:::\n::::'
    const doc = parseResume(source)
    expect(doc.sections[0].line).toBe(4)
    expect(doc.sections[0].items[0].line).toBe(6)
    expect(doc.sections[0].items[0].endLine).toBe(10)
    expect(doc.sections[0].endLine).toBe(11)
  })

  it('解析章节 placement', () => {
    const doc = parseResume(':::: skills side\n## 技能\n- A\n::::')
    expect(doc.sections[0].placement).toBe('side')
  })

  it('3 个冒号的章节开头会提示写法错误', () => {
    const source = '::: experience\n## x\n'
    const doc = parseResume(source)
    expect(doc.diagnostics.some((item) => item.code === 'SEC_OPEN_TOO_SHORT')).toBe(true)
    expect(doc.sections).toHaveLength(0)
  })

  it('空文档不抛异常', () => {
    const doc = parseResume('')
    expect(doc.sections).toHaveLength(0)
    expect(doc.preamble).toBe('')
    expect(doc.diagnostics).toHaveLength(0)
  })
})
