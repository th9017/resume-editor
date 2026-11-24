import { describe, expect, it } from 'vitest'
import { parseResume } from '../src/core/parser'
import { lintResume } from '../src/core/lint'

function codes(source: string): string[] {
  return lintResume(parseResume(source)).map((item) => item.code)
}

function issue(source: string, code: string) {
  return lintResume(parseResume(source)).find((item) => item.code === code)
}

describe('resume lint', () => {
  it('缺少抬头与联系方式', () => {
    const found = codes(':::: summary\n## 简介\n写了一点东西。\n::::')
    expect(found).toContain('NAME_MISSING')
    expect(found).toContain('CONTACT_NONE')
  })

  it('邮箱格式可疑时告警，正常邮箱不报', () => {
    expect(codes('---\nname: 张三\ncontact:\n  email: zhang at example\n  phone: "13800000000"\n---')).toContain(
      'EMAIL_FORMAT',
    )
    expect(
      codes('---\nname: 张三\ncontact:\n  email: zhang@example.com\n  phone: "13800000000"\n---'),
    ).not.toContain('EMAIL_FORMAT')
  })

  it('时间倒序不报，正序告警', () => {
    const ordered = codes(
      '---\nname: 张三\ncontact:\n  email: a@b.co\n---\n:::: experience\n## 工作经历\n\n::: item\ncompany: 近\nperiod: 2023.01 — 至今\n---\n- 提升 30%\n:::\n\n::: item\ncompany: 远\nperiod: 2020.01 — 2022.12\n---\n- 降本 12%\n:::\n::::',
    )
    expect(ordered).not.toContain('ORDER_NOT_DESC')

    const reversed = ordered.length
    const bad = codes(
      '---\nname: 张三\ncontact:\n  email: a@b.co\n---\n:::: experience\n## 工作经历\n\n::: item\ncompany: 远\nperiod: 2020.01 — 2022.12\n---\n- 降本 12%\n:::\n\n::: item\ncompany: 近\nperiod: 2023.01 — 至今\n---\n- 提升 30%\n:::\n::::',
    )
    expect(bad).toContain('ORDER_NOT_DESC')
    expect(reversed).toBeDefined()
  })

  it('空章节提示导出时不会出现', () => {
    const found = issue('---\nname: 张三\ncontact:\n  email: a@b.co\n---\n:::: awards\n## 荣誉奖项\n::::', 'SECTION_EMPTY')
    expect(found?.severity).toBe('warn')
    expect(found?.message).toContain('荣誉奖项')
  })

  it('要点缺少数字与过长分别给建议', () => {
    const source = [
      '---',
      'name: 张三',
      'contact:',
      '  email: a@b.co',
      '---',
      ':::: experience',
      '## 工作经历',
      '',
      '::: item',
      'company: 甲',
      'period: 2022 — 至今',
      '---',
      '- 负责系统的建设与维护并且持续跟进各种线上问题的排查与处理以及后续优化同时承担新人培养与跨部门沟通确保项目按计划交付并推动团队工程实践落地',
      '- 参与需求评审',
      ':::',
      '::::',
    ].join('\n')
    const found = codes(source)
    expect(found).toContain('NOT_QUANTIFIED')
    expect(found).toContain('BULLET_LONG')
  })

  it('中文后跟半角标点计入混用', () => {
    const source = '---\nname: 张三\ncontact:\n  email: a@b.co\n---\n:::: summary\n## 简介\n负责网关,提升性能;优化体验\n::::'
    expect(codes(source)).toContain('PUNCT_MIX')
  })

  it('全角标点与版本号不误报', () => {
    const source =
      '---\nname: 张三\ncontact:\n  email: a@b.co\n---\n:::: summary\n## 简介\n基于 Vue 3.4、TypeScript；完成灰度。\n::::'
    expect(codes(source)).not.toContain('PUNCT_MIX')
  })

  it('"我"开头的要点建议改无主语', () => {
    const source = [
      '---',
      'name: 张三',
      'contact:',
      '  email: a@b.co',
      '---',
      ':::: experience',
      '## 工作经历',
      '',
      '::: item',
      'company: 甲',
      'period: 2022 — 至今',
      '---',
      '- 我负责了整体架构',
      '- 提升 30%',
      ':::',
      '::::',
    ].join('\n')
    expect(codes(source)).toContain('FIRST_PERSON')
  })

  it('跳转定位到对应章节下标', () => {
    const found = issue(
      '---\nname: 张三\ncontact:\n  email: a@b.co\n---\n:::: summary\n## 简介\n有内容。\n::::\n\n:::: awards\n## 荣誉奖项\n::::',
      'SECTION_EMPTY',
    )
    expect(found?.sectionIndex).toBe(1)
    expect(found?.sectionTitle).toBe('荣誉奖项')
  })

  it('结构完整的简历没有必须处理的项', () => {
    const source = [
      '---',
      'name: 张三',
      'title: 前端工程师',
      'contact:',
      '  email: zhang@example.com',
      '  phone: "13800000000"',
      '---',
      ':::: summary',
      '## 个人简介',
      '六年前端经验，专注桌面端与数据密集型应用。',
      '::::',
      '',
      ':::: experience',
      '## 工作经历',
      '',
      '::: item',
      'company: 甲',
      'role: 负责人',
      'period: 2021.03 — 至今',
      '---',
      '- 主导编辑器重构，首屏从 1.8s 降至 0.6s',
      '- 建立质量门禁，线上事故减少 50%',
      ':::',
      '::::',
    ].join('\n')
    const issues = lintResume(parseResume(source))
    expect(issues.filter((item) => item.severity !== 'info')).toEqual([])
  })
})
