import { describe, expect, it } from 'vitest'
import { analyzeSource } from '../src/core/draft'
import { parseResume } from '../src/core/parser'
import { importPlainMarkdown, looksLikePlainMarkdown } from '../src/core/markdownImport'

describe('plain markdown import', () => {
  it('识别应用自身格式并跳过', () => {
    expect(looksLikePlainMarkdown('')).toBe(false)
    expect(looksLikePlainMarkdown('just text')).toBe(false)
    expect(looksLikePlainMarkdown('## 工作经历\n内容')).toBe(true)
    expect(looksLikePlainMarkdown(':::: experience\n## 工作经历\n::::')).toBe(false)
  })

  it('标题映射到内置章节类型，未知标题成为自定义章节', () => {
    const markdown = importPlainMarkdown(
      ['# 张三', '## 个人简介', '两年经验。', '## Work Experience', '### 甲公司', '- 做过乙', '## 论文', '一篇在投'].join('\n'),
    )
    const doc = parseResume(markdown)
    expect(doc.identity.name).toBe('张三')
    expect(doc.sections.map((section) => section.type)).toEqual([
      'summary',
      'experience',
      'custom',
    ])
    expect(doc.sections[2].title).toBe('论文')
    expect(doc.sections[1].items[0].fields.company).toBe('甲公司')
    expect(doc.sections[1].items[0].body).toContain('- 做过乙')
  })

  it('要点、补充说明与技能分别落到正确位置', () => {
    const markdown = importPlainMarkdown(
      [
        '## 专业技能',
        '- TypeScript',
        '- Vue 3',
        '## 项目经历',
        '### 简历编辑器',
        '本地优先的桌面应用。',
        '- 首屏从 1.8s 降到 0.6s',
        '- 建立质量门禁',
      ].join('\n'),
    )
    const doc = parseResume(markdown)
    const skills = doc.sections.find((section) => section.type === 'skills')
    expect(skills?.body).toBe('- TypeScript\n- Vue 3')
    const project = doc.sections.find((section) => section.type === 'projects')?.items[0]
    expect(project?.fields.name).toBe('简历编辑器')
    expect(project?.body).toContain('- 首屏从 1.8s 降到 0.6s')
    expect(project?.body).toContain('本地优先的桌面应用。')
  })

  it('首个标题之前的段落进入个人简介', () => {
    const doc = parseResume(importPlainMarkdown(['开场自我介绍。', '## 教育背景', '### 某大学'].join('\n')))
    expect(doc.sections[0].type).toBe('summary')
    expect(doc.sections[0].body).toBe('开场自我介绍。')
    expect(doc.sections[1].items[0].fields.school).toBe('某大学')
  })

  it('没有任何标题时原文保留为个人简介', () => {
    const doc = parseResume(importPlainMarkdown('只有一段话，没有标题。'))
    expect(doc.sections).toHaveLength(1)
    expect(doc.sections[0].type).toBe('summary')
    expect(doc.sections[0].body).toBe('只有一段话，没有标题。')
  })

  it('导入结果可无提示直接进入表单', () => {
    const markdown = importPlainMarkdown(
      [
        '# 李四',
        '五年后端经验。',
        '## 工作经历',
        '### 某公司',
        '- 负责网关',
        '## 专业技能',
        '- Go',
      ].join('\n'),
    )
    const { draft, diagnostics } = analyzeSource(markdown)
    expect(diagnostics).toEqual([])
    expect(draft.identity.name).toBe('李四')
    expect(draft.sections.map((section) => section.type)).toEqual(['summary', 'experience', 'skills'])
    expect(draft.sections[1].items[0].fields.company).toBe('某公司')
    expect(draft.sections[1].items[0].bullets).toEqual(['负责网关'])
    expect(draft.sections[2].bullets).toEqual(['Go'])
  })

  it('导入结果可再次被导入检测排除', () => {
    const markdown = importPlainMarkdown('## 工作经历\n### 甲\n- 乙')
    expect(looksLikePlainMarkdown(markdown)).toBe(false)
  })
})
