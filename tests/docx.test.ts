import { describe, expect, it } from 'vitest'
import { importPlainMarkdown } from '../src/core/markdownImport'
import {
  docxParagraphsToMarkdown,
  docxToMarkdown,
  parseDocxStyles,
  readDocxParagraphs,
} from '../src/core/docx'
import { buildZip } from './support/zipFixture'

function documentXml(body: string): string {
  return `<w:document><w:body>${body}<w:sectPr><w:pgSz w:w="11906"/></w:sectPr></w:body></w:document>`
}

const RESUME_BODY = `
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>张三</w:t></w:r></w:p>
<w:p><w:r><w:t>电话：13800000000 · 邮箱 zhang@example.com</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>工作经历</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>某公司 · 前端工程师</w:t></w:r><w:r><w:t>（2021.07 至今）</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>负责 </w:t></w:r><w:r><w:t>A 项目</w:t></w:r><w:r><w:tab/><w:t>转化率 +12%</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>教育背景</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>某大学 计算机科学与技术</w:t></w:r></w:p>
`

function docx(entries: { document: string; styles?: string }): Uint8Array {
  return buildZip([
    { name: '[Content_Types].xml', content: '<Types/>' },
    { name: 'word/document.xml', content: entries.document, deflate: true },
    ...(entries.styles
      ? [{ name: 'word/styles.xml', content: entries.styles, deflate: true }]
      : []),
  ])
}

describe('docx 段落解析', () => {
  it('按样式与大纲级别还原标题层级', () => {
    const paragraphs = readDocxParagraphs(documentXml(RESUME_BODY))
    expect(paragraphs.map((entry) => [entry.level, entry.bullet, entry.text])).toEqual([
      [0, false, '张三'],
      [0, false, '电话：13800000000 · 邮箱 zhang@example.com'],
      [1, false, '工作经历'],
      [2, false, '某公司 · 前端工程师（2021.07 至今）'],
      [0, true, '负责 A 项目 转化率 +12%'],
      [1, false, '教育背景'],
      [2, false, '某大学 计算机科学与技术'],
    ])
  })

  it('styleId 是数字时从 styles.xml 的名称和 outlineLvl 推断级别', () => {
    const styles = parseDocxStyles(
      `<w:styles>
        <w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
        <w:style w:type="paragraph" w:styleId="21"><w:name w:val="标题 3"/></w:style>
        <w:style w:type="character" w:styleId="a"><w:name w:val="Default Paragraph Font"/></w:style>
      </w:styles>`,
    )
    const paragraphs = readDocxParagraphs(
      documentXml(
        `<w:p><w:pPr><w:pStyle w:val="1"/></w:pPr><w:r><w:t>项目经历</w:t></w:r></w:p>
         <w:p><w:pPr><w:pStyle w:val="21"/></w:pPr><w:r><w:t>细节</w:t></w:r></w:p>
         <w:p><w:pPr><w:pStyle w:val="a"/></w:pPr><w:r><w:t>正文</w:t></w:r></w:p>`,
      ),
      styles,
    )
    expect(paragraphs.map((entry) => entry.level)).toEqual([1, 3, 0])
  })

  it('段内 outlineLvl 优先于样式，制表符与实体都能落地', () => {
    const paragraphs = readDocxParagraphs(
      documentXml(
        `<w:p><w:pPr><w:outlineLvl w:val="1"/><w:pStyle w:val="Heading5"/></w:pPr>
           <w:r><w:t xml:space="preserve">技能 &amp; 特长</w:t></w:r><w:r><w:tab/><w:t>C&#65;b</w:t></w:r></w:p>`,
      ),
    )
    expect(paragraphs[0]).toMatchObject({ level: 2, text: '技能 & 特长 CAb' })
  })

  it('没有标题样式时，整段加粗的短行退化为章节标题', () => {
    const paragraphs = readDocxParagraphs(
      documentXml(
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>项目经历</w:t></w:r></w:p>
         <w:p><w:r><w:t>项目 A：负责前端</w:t></w:r></w:p>
         <w:p><w:r><w:rPr><w:b/></w:rPr><w:rPr><w:i/></w:rPr><w:t>这段太长不足以当标题所以不应该被识别为一行标题的加粗文本内容继续加长</w:t></w:r></w:p>`,
      ),
    )
    expect(paragraphs.map((entry) => [entry.level, entry.boldOnly])).toEqual([
      [0, true],
      [0, false],
      [0, true],
    ])
    const markdown = docxParagraphsToMarkdown(paragraphs)
    expect(markdown.startsWith('## 项目经历')).toBe(true)
    expect(markdown).toContain('这段太长不足以当标题')
    expect(markdown).not.toContain('## 这段太长')
  })
})

describe('docx 转 Markdown', () => {
  it('最浅一级标题映射成章节，下一级映射成条目', () => {
    const markdown = docxParagraphsToMarkdown(readDocxParagraphs(documentXml(RESUME_BODY)))
    expect(markdown).toContain('# 张三')
    expect(markdown).toContain('## 工作经历')
    expect(markdown).toContain('### 某公司 · 前端工程师（2021.07 至今）')
    expect(markdown).toContain('- 负责 A 项目 转化率 +12%')
    expect(markdown).toContain('电话：13800000000')
  })

  it('首行像手机号或求职意向时不会被当成姓名', () => {
    const markdown = docxParagraphsToMarkdown(
      readDocxParagraphs(
        documentXml(
          `<w:p><w:r><w:t>13800000000</w:t></w:r></w:p>
           <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>求职意向：前端</w:t></w:r></w:p>`,
        ),
      ),
    )
    expect(markdown).not.toContain('# 13800000000')
    expect(markdown).toContain('## 求职意向：前端')
  })

  it('整份 DOCX 能一路导入成应用自己的章节格式', async () => {
    const markdown = await docxToMarkdown(docx({ document: documentXml(RESUME_BODY) }))
    const result = importPlainMarkdown(markdown)
    expect(result).toContain('name: 张三')
    expect(result).toContain(':::: experience')
    expect(result).toContain(':::: education')
    expect(result).toContain('::: item')
    expect(result).toContain('- 负责 A 项目 转化率 +12%')
    expect(result).toContain('company: 某公司 · 前端工程师（2021.07 至今）')
  })

  it('缺少 word/document.xml 或不是 ZIP 时报错清楚', async () => {
    await expect(docxToMarkdown(buildZip([{ name: 'readme.txt', content: 'hi' }]))).rejects.toThrow(
      'word/document.xml',
    )
    await expect(docxToMarkdown(new TextEncoder().encode('\xd0\xcf\x11\xe0old doc'))).rejects.toThrow(
      '.docx',
    )
  })

  it('正文全空时不产出空文档', async () => {
    await expect(
      docxToMarkdown(docx({ document: documentXml('<w:p><w:r><w:t>   </w:t></w:r></w:p>') })),
    ).rejects.toThrow('没有可导入的文字')
  })
})
