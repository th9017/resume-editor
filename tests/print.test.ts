import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildResumePrintHtml } from '../src/core/print'
import { parseResume } from '../src/core/parser'
import { getTemplate } from '../src/core/render/templates'
import { SHOWCASE_MARKDOWN } from '../src/samples/showcase'

describe('print html', () => {
  it('打印 CSS 包含 A4 与分页规则', () => {
    const css = readFileSync(
      new URL('../src/core/render/styles/print.css', import.meta.url),
      'utf8',
    )
    expect(css).toContain('@page')
    expect(css).toContain('size: A4 portrait')
    expect(css).toContain('break-inside: avoid')
    expect(css).toContain('print-color-adjust: exact')
  })

  it('生成包含模板类名与标题的自包含 HTML', () => {
    const html = buildResumePrintHtml({
      doc: parseResume(SHOWCASE_MARKDOWN),
      template: getTemplate('classic'),
      title: '张一鸣-简历',
      imageUrls: new Map(),
    })
    expect(html).toContain('rv--classic')
    expect(html).toContain('张一鸣')
    expect(html).toContain('<title>张一鸣-简历</title>')
    expect(html).not.toContain('<script')
    expect(html).toContain('<style>')
  })

  it('内联本地图片并标记缺失图片', () => {
    const doc = parseResume(
      ':::: skills\n## 技能\n![本地](assets/a.png)\n\n![缺失](assets/missing.png)\n::::',
    )
    const html = buildResumePrintHtml({
      doc,
      template: getTemplate('classic'),
      title: '测试',
      imageUrls: new Map([
        ['assets/a.png', 'data:image/png;base64,AAAA'],
        ['assets/missing.png', ''],
      ]),
    })
    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).toContain('rv-img-missing')
  })

  it('远程图片保持原 URL', () => {
    const doc = parseResume(':::: skills\n## 技能\n![远程](https://example.com/a.png)\n::::')
    const html = buildResumePrintHtml({
      doc,
      template: getTemplate('classic'),
      title: '测试',
      imageUrls: new Map(),
    })
    expect(html).toContain('src="https://example.com/a.png"')
  })

  it('双栏模板打印使用同一套模板类名', () => {
    const html = buildResumePrintHtml({
      doc: parseResume(SHOWCASE_MARKDOWN),
      template: getTemplate('sidebar'),
      title: '张一鸣-简历',
      imageUrls: new Map(),
    })
    expect(html).toContain('rv--sidebar')
    expect(html).toContain('rv-grid')
  })
})