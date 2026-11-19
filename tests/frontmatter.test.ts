import { describe, expect, it } from 'vitest'
import {
  patchAvatar,
  patchStyle,
  readFrontmatter,
} from '../src/core/frontmatter'
import { DEFAULT_STYLE } from '../src/core/types'

describe('readFrontmatter', () => {
  it('没有 frontmatter 时返回默认值', () => {
    const read = readFrontmatter('Hello')
    expect(read.fm).toBeNull()
    expect(read.identity.name).toBe('')
    expect(read.style).toEqual(DEFAULT_STYLE)
    expect(read.body).toBe('Hello')
    expect(read.bodyStartLine).toBe(1)
    expect(read.diagnostics).toHaveLength(0)
  })

  it('读取姓名、联系方式与样式', () => {
    const source = `---
name: 张三
title: 前端工程师
avatar: assets/a.png
contact:
  email: zhang@example.com
  website: example.com
style:
  template: sidebar
  accent: "#ABC"
  font_size: 9.5
  spacing: compact
  auto_fit: false
---
body`
    const read = readFrontmatter(source)
    expect(read.identity.name).toBe('张三')
    expect(read.identity.title).toBe('前端工程师')
    expect(read.identity.avatar).toBe('assets/a.png')
    expect(read.identity.contacts[0]).toMatchObject({
      key: 'email',
      value: 'zhang@example.com',
      href: 'mailto:zhang@example.com',
    })
    expect(read.identity.contacts[1]).toMatchObject({
      key: 'website',
      href: 'https://example.com',
    })
    expect(read.style).toEqual({
      template: 'sidebar',
      accent: '#aabbcc',
      fontSize: 9.5,
      spacing: 'compact',
      autoFit: false,
    })
    expect(read.body).toBe('body')
    expect(read.bodyStartLine).toBe(15)
  })

  it('非法样式值回退并给出警告', () => {
    const source = `---
style:
  template: nope
  accent: red
  font_size: 20
  spacing: huge
  auto_fit: maybe
---
body`
    const read = readFrontmatter(source)
    expect(read.style).toEqual({
      ...DEFAULT_STYLE,
      fontSize: 12,
    })
    const codes = read.diagnostics.map((item) => item.code)
    expect(codes).toContain('STYLE_TEMPLATE')
    expect(codes).toContain('STYLE_ACCENT')
    expect(codes).toContain('STYLE_SPACING')
    expect(codes).toContain('STYLE_AUTO_FIT')
  })

  it('未知联系方式作为自定义项并提示', () => {
    const read = readFrontmatter(`---
contact:
  wechat: li4
  portfolio: example.com
---
body`)
    expect(read.identity.contacts.map((item) => item.key)).toEqual(['wechat', 'portfolio'])
    expect(read.diagnostics.some((item) => item.code === 'CONTACT_UNKNOWN')).toBe(true)
  })
})

describe('patchStyle', () => {
  it('无 frontmatter 时创建并写入样式', () => {
    const source = ':::: summary\n## 简介\nHi\n::::'
    const next = patchStyle(source, {
      template: 'sidebar',
      accent: '#ff0000',
      fontSize: 9.5,
      spacing: 'compact',
      autoFit: false,
    })
    expect(next.startsWith('---\nstyle:\n')).toBe(true)
    const read = readFrontmatter(next)
    expect(read.style.template).toBe('sidebar')
    expect(read.style.accent).toBe('#ff0000')
    expect(read.style.fontSize).toBe(9.5)
    expect(read.style.spacing).toBe('compact')
    expect(read.style.autoFit).toBe(false)
    expect(read.body).toContain(':::: summary')
  })

  it('替换 style 块并保留其他 frontmatter 内容与注释', () => {
    const source = `---
# 我的简历
name: 张三
style:
  template: classic
  accent: "#2563eb"
avatar: assets/a.png
---
body`
    const next = patchStyle(source, {
      template: 'sidebar',
      accent: '#112233',
      fontSize: 10,
      spacing: 'normal',
      autoFit: true,
    })
    expect(next).toContain('# 我的简历')
    expect(next).toContain('name: 张三')
    expect(next).toContain('avatar: assets/a.png')
    expect((next.match(/^style:/gm) ?? []).length).toBe(1)
    const read = readFrontmatter(next)
    expect(read.style.template).toBe('sidebar')
    expect(read.style.accent).toBe('#112233')
    expect(read.style.fontSize).toBe(10)
  })

  it('已有 frontmatter 但没有 style 时追加', () => {
    const next = patchStyle('---\nname: 张三\n---\nbody', { template: 'compact' })
    const read = readFrontmatter(next)
    expect(read.style.template).toBe('compact')
    expect(read.identity.name).toBe('张三')
    expect(read.body).toBe('body')
  })

  it('frontmatter 语法错误时拒绝写入', () => {
    expect(() => patchStyle('---\nname: [broken\n---\nbody', { template: 'classic' })).toThrow()
  })
})

describe('patchAvatar', () => {
  it('无 frontmatter 时创建 avatar', () => {
    const next = patchAvatar('body', 'assets/avatar.jpg')
    const read = readFrontmatter(next)
    expect(read.identity.avatar).toBe('assets/avatar.jpg')
    expect(read.body.trim()).toBe('body')
  })

  it('已有 frontmatter 时插入 avatar', () => {
    const next = patchAvatar('---\nname: X\n---\nbody', 'assets/a b.png')
    const read = readFrontmatter(next)
    expect(read.identity.avatar).toBe('assets/a b.png')
    expect(read.body).toBe('body')
  })

  it('替换现有 avatar 且不重复', () => {
    const next = patchAvatar('---\nname: X\navatar: old.png\n---\nbody', 'assets/new.png')
    const read = readFrontmatter(next)
    expect(read.identity.avatar).toBe('assets/new.png')
    expect((next.match(/^avatar:/gm) ?? []).length).toBe(1)
  })
})