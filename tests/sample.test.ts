import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseResume } from '../src/core/parser'

describe('sample resume', () => {
  it('samples/example-resume.md 可被完整解析', () => {
    const source = readFileSync(
      new URL('../samples/example-resume.md', import.meta.url),
      'utf8',
    )
    const doc = parseResume(source)
    expect(doc.identity.name).toBe('张一鸣')
    expect(doc.sections.map((section) => section.type)).toEqual([
      'summary',
      'experience',
      'projects',
      'education',
      'skills',
      'awards',
    ])
    expect(doc.sections.find((section) => section.type === 'experience')?.items).toHaveLength(2)
    expect(doc.diagnostics.filter((item) => item.severity === 'error')).toHaveLength(0)
  })
})