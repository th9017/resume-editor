import { describe, expect, it } from 'vitest'
import { parseResume } from '../src/core/parser'
import {
  analyzeSource,
  collectUnsupported,
  composeItemBody,
  docToDraft,
  draftToDoc,
  serializeDraft,
  splitItemBody,
  type ResumeDraft,
} from '../src/core/draft'
import { SHOWCASE_MARKDOWN } from '../src/samples/showcase'

function stripIds(draft: ResumeDraft): unknown {
  return {
    ...draft,
    sections: draft.sections.map((section) => ({
      type: section.type,
      title: section.title,
      placement: section.placement,
      body: section.body,
      bullets: section.bullets,
      items: section.items.map((item) => ({
        fields: item.fields,
        bullets: item.bullets,
        note: item.note,
      })),
    })),
  }
}

describe('draft round-trip', () => {
  it('样例简历 serialize -> parse -> draft 等价', () => {
    const draft = docToDraft(parseResume(SHOWCASE_MARKDOWN))
    const text = serializeDraft(draft)
    const round = docToDraft(parseResume(text))
    expect(stripIds(round)).toEqual(stripIds(draft))
  })

  it('自定义章节、要点与补充说明可往返', () => {
    const draft = docToDraft(parseResume(SHOWCASE_MARKDOWN))
    draft.sections.push({
      id: 'x',
      type: 'custom',
      title: '证书与语言',
      placement: 'side',
      body: '补充说明段落。',
      bullets: [],
      items: [
        {
          id: 'i',
          fields: { title: '英语六级', subtitle: 'CET-6', period: '2020' },
          bullets: ['阅读与写作熟练'],
          note: '分数：580',
        },
      ],
    })
    const round = docToDraft(parseResume(serializeDraft(draft)))
    expect(stripIds(round)).toEqual(stripIds(draft))
  })

  it('空条目可往返', () => {
    const draft = docToDraft(parseResume(SHOWCASE_MARKDOWN))
    const exp = draft.sections.find((section) => section.type === 'experience')!
    exp.items.push({ id: 'empty', fields: {}, bullets: [], note: '' })
    const round = docToDraft(parseResume(serializeDraft(draft)))
    const roundExp = round.sections.find((section) => section.type === 'experience')!
    expect(roundExp.items).toHaveLength(exp.items.length)
  })

  it('frontmatter 特殊字符可往返', () => {
    const draft = docToDraft(
      parseResume('---\nname: 张三\n---\n:::: summary\n## 简介\nHi\n::::'),
    )
    const email = draft.identity.contacts.find((contact) => contact.key === 'email')!
    email.value = 'a:b "c" #d@example.com'
    const doc = parseResume(serializeDraft(draft))
    expect(
      doc.identity.contacts.find((contact) => contact.key === 'email')?.value,
    ).toBe('a:b "c" #d@example.com')
  })
})

describe('body helpers', () => {
  it('split/compose 要点和补充说明', () => {
    const split = splitItemBody('- 第一条\n- 第二条\n\n补充段落')
    expect(split.bullets).toEqual(['第一条', '第二条'])
    expect(split.note).toBe('补充段落')
    expect(composeItemBody({ bullets: split.bullets, note: split.note })).toBe(
      '- 第一条\n- 第二条\n\n补充段落',
    )
  })
})

describe('unsupported content', () => {
  it('未知章节、字段、preamble 被标记', () => {
    const doc = parseResume(
      '前言\n:::: volunteer\n## 志愿\n- x\n::::\n:::: experience\n## 工作\n::: item\nfoo: bar\n---\n- x\n:::\n::::',
    )
    const diagnostics = collectUnsupported(doc)
    expect(diagnostics.some((item) => item.code === 'SEC_UNKNOWN')).toBe(true)
    expect(diagnostics.some((item) => item.code === 'FIELD_UNKNOWN')).toBe(true)
    expect(diagnostics.some((item) => item.code === 'PREAMBLE')).toBe(true)
  })

  it('未知 frontmatter 字段被标记', () => {
    const doc = parseResume('---\nname: X\nfoo: bar\n---\n:::: summary\n## 简介\nHi\n::::')
    expect(collectUnsupported(doc).some((item) => item.code === 'FM_UNKNOWN')).toBe(true)
  })

  it('analyzeSource 返回 draft 与 diagnostics', () => {
    const result = analyzeSource(SHOWCASE_MARKDOWN)
    expect(result.draft.sections.length).toBeGreaterThan(0)
    expect(result.diagnostics.filter((item) => item.severity === 'error')).toHaveLength(0)
  })
})

describe('draftToDoc', () => {
  it('生成渲染可用文档并过滤空联系人', () => {
    const draft = docToDraft(parseResume(SHOWCASE_MARKDOWN))
    const doc = draftToDoc(draft)
    expect(doc.identity.name).toBe('张一鸣')
    expect(doc.identity.contacts.every((contact) => contact.value !== '')).toBe(true)
    expect(doc.sections[0].type).toBe('summary')
  })
})