import { describe, expect, it } from 'vitest'
import { parseResume } from '../src/core/parser'
import { escapeHtml, isSafeImageSrc, isSafeLink } from '../src/core/render/escape'
import { renderResume } from '../src/core/render/renderer'
import { getTemplate } from '../src/core/render/templates'
import { SHOWCASE_MARKDOWN } from '../src/samples/showcase'

function render(source: string, templateId: 'classic' | 'sidebar' | 'compact' = 'classic'): string {
  const doc = parseResume(source)
  return renderResume(doc, { template: getTemplate(templateId) })
}

describe('renderer', () => {
  it('转义姓名、标题与字段值中的 HTML', () => {
    const html = render(
      '---\nname: "<script>alert(1)</script>"\n---\n:::: summary\n## <b>简介</b>\nHi\n::::',
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;b&gt;简介&lt;/b&gt;')
  })

  it('安全链接保留 target 与 rel', () => {
    const html = render(
      ':::: experience\n::: item\ncompany: A\nlink: https://example.com\n---\n:::\n::::',
    )
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })

  it('javascript 链接被阻断', () => {
    const html = render(
      ':::: experience\n::: item\ncompany: [x](javascript:alert(1))\n---\n:::\n::::',
    )
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('<a ')
  })

  it('图片 src 协议白名单', () => {
    const doc = parseResume(':::: skills\n## 技能\n![ok](assets/a.png)\n::::')
    const safeHtml = renderResume(doc, { template: getTemplate('classic') })
    expect(safeHtml).toContain('src="assets/a.png"')

    const unsafeHtml = renderResume(doc, {
      template: getTemplate('classic'),
      resolveImage: () => 'javascript:void',
    })
    expect(unsafeHtml).not.toContain('src="javascript:')
    expect(unsafeHtml).toContain('rv-img-missing')

    const missingHtml = renderResume(doc, {
      template: getTemplate('classic'),
      resolveImage: () => '',
    })
    expect(missingHtml).toContain('rv-img-missing')
    expect(missingHtml).not.toContain('<img')
  })

  it('双栏模板把默认侧栏章节放到 side', () => {
    const html = render(SHOWCASE_MARKDOWN, 'sidebar')
    expect(html).toContain('rv--sidebar')
    expect(html).toContain('rv-grid')
    const sideStart = html.indexOf('<aside class="rv-side">')
    const mainStart = html.indexOf('<main class="rv-main">')
    const educationIndex = html.indexOf('data-type="education"')
    const experienceIndex = html.indexOf('data-type="experience"')
    expect(sideStart).toBeGreaterThan(-1)
    expect(mainStart).toBeGreaterThan(sideStart)
    expect(educationIndex).toBeGreaterThan(sideStart)
    expect(educationIndex).toBeLessThan(mainStart)
    expect(experienceIndex).toBeGreaterThan(mainStart)
  })

  it('单栏模板不生成侧栏', () => {
    const html = render(SHOWCASE_MARKDOWN, 'classic')
    expect(html).toContain('rv--classic')
    expect(html).not.toContain('rv-side')
  })

  it('条目字段按布局渲染到 lead/meta/sub', () => {
    const html = render(
      ':::: experience\n::: item\ncompany: 蓝鲸科技\nrole: 工程师\nperiod: 2022\nlocation: 上海\nstack: Vue\nlink: https://example.com\n---\n- x\n:::\n::::',
    )
    expect(html).toContain('rv-item-lead')
    expect(html).toContain('data-field="company"')
    expect(html).toContain('rv-item-meta')
    expect(html).toContain('data-field="period"')
    expect(html).toContain('rv-item-sub')
    expect(html).toContain('data-field="stack"')
  })

  it('未知字段进入附加信息区', () => {
    const html = render(':::: experience\n::: item\ncompany: A\nfoo: bar\n---\n:::\n::::')
    expect(html).toContain('rv-field-extra')
    expect(html).toContain('foo: bar')
  })

  it('没有头像时使用姓名首字', () => {
    const html = render('---\nname: 张三\n---\n:::: summary\n## 简介\nHi\n::::')
    expect(html).toContain('rv-avatar-initial')
    expect(html).toContain('张')
  })

  it('头像通过 resolveImage 解析', () => {
    const doc = parseResume(
      '---\nname: 张三\navatar: assets/a.png\n---\n:::: summary\n## 简介\nHi\n::::',
    )
    const html = renderResume(doc, {
      template: getTemplate('classic'),
      resolveImage: (src) => `asset://localhost/${src}`,
    })
    expect(html).toContain('src="asset://localhost/assets/a.png"')
  })

  it('章节外正文渲染在顶部', () => {
    const html = render('前言\n:::: summary\n## 简介\nHi\n::::')
    expect(html).toContain('rv-section--preamble')
    expect(html).toContain('前言')
  })

  it('空章节不渲染', () => {
    const html = render(':::: experience\n## 工作经历\n::::')
    expect(html).not.toContain('data-type="experience"')
  })

  it('只有空条目的章节不渲染标题', () => {
    const html = render(':::: experience\n## 工作经历\n::: item\n---\n:::\n::::')
    expect(html).not.toContain('data-type="experience"')
  })

  it('样式变量写入文章根节点', () => {
    const doc = parseResume(
      '---\nstyle:\n  accent: "#ff0000"\n  font_size: 9\n---\n:::: summary\n## 简介\nHi\n::::',
    )
    const html = renderResume(doc, { template: getTemplate('classic'), fit: 0.9 })
    expect(html).toContain('--rv-accent: #ff0000')
    expect(html).toContain('--rv-base: 9pt')
    expect(html).toContain('--rv-fit: 0.9')
    expect(html).toContain('--rv-accent-soft:')
  })
})

describe('escape helpers', () => {
  it('escapeHtml', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })

  it('链接协议白名单', () => {
    expect(isSafeLink('https://example.com')).toBe(true)
    expect(isSafeLink('mailto:a@b.c')).toBe(true)
    expect(isSafeLink('tel:123')).toBe(true)
    expect(isSafeLink('javascript:alert(1)')).toBe(false)
    expect(isSafeLink('data:text/html,x')).toBe(false)
  })

  it('图片协议白名单', () => {
    expect(isSafeImageSrc('assets/a.png')).toBe(true)
    expect(isSafeImageSrc('https://example.com/a.png')).toBe(true)
    expect(isSafeImageSrc('data:image/png;base64,abc')).toBe(true)
    expect(isSafeImageSrc('data:text/html,<script>')).toBe(false)
    expect(isSafeImageSrc('javascript:void')).toBe(false)
    expect(isSafeImageSrc('file:///C:/a.png')).toBe(false)
  })
})