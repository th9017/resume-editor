import { describe, expect, it } from 'vitest'
import { compressDiff, diffLines, summarize } from '../src/core/diff'

function text(lines: string[]): string {
  return lines.join('\n')
}

const MARK = { same: ' ', add: '+', del: '-' } as const

function flat(lines: ReturnType<typeof diffLines>): string[] {
  return lines.map((line) => `${MARK[line.kind]}${line.text}`)
}

describe('line diff', () => {
  it('完全相同时没有增删', () => {
    const source = text(['a', 'b', 'c'])
    const lines = diffLines(source, source)
    expect(summarize(lines)).toEqual({ added: 0, removed: 0, changed: false })
    expect(lines.every((line) => line.kind === 'same')).toBe(true)
  })

  it('中间一行改动只标记该行', () => {
    expect(flat(diffLines(text(['a', 'b', 'c']), text(['a', 'x', 'c'])))).toEqual([
      ' a',
      '-b',
      '+x',
      ' c',
    ])
  })

  it('插入与删除分别落到 add 与 del', () => {
    expect(flat(diffLines(text(['a', 'c']), text(['a', 'b', 'c'])))).toEqual([' a', '+b', ' c'])
    expect(flat(diffLines(text(['a', 'b', 'c']), text(['a', 'c'])))).toEqual([' a', '-b', ' c'])
  })

  it('统一 CRLF 后比较', () => {
    const lines = diffLines('a\r\nb\r\n', 'a\nb\n')
    expect(summarize(lines).changed).toBe(false)
  })

  it('末尾换行差异不算改动', () => {
    expect(summarize(diffLines('a\nb', 'a\nb\n')).changed).toBe(false)
  })

  it('统计增删行数', () => {
    const summary = summarize(diffLines(text(['a', 'b']), text(['a', 'x', 'y'])))
    expect(summary).toEqual({ added: 2, removed: 1, changed: true })
  })
})

describe('diff 压缩', () => {
  it('长段相同行折叠为 skip', () => {
    const before = Array.from({ length: 20 }, (_, index) => `l${index}`)
    const after = [...before]
    after[15] = 'changed'
    const chunks = compressDiff(diffLines(text(before), text(after)), 2)
    const kinds = chunks.map((chunk) => chunk.kind)
    expect(kinds).toContain('skip')
    expect(chunks.some((chunk) => chunk.text === 'changed')).toBe(true)
    const skipped = chunks.filter((chunk) => chunk.kind === 'skip')
    expect(skipped.reduce((total, chunk) => total + (chunk.count ?? 0), 0)).toBeGreaterThan(10)
  })

  it('首尾上下文各保留 context 行', () => {
    const before = Array.from({ length: 10 }, (_, index) => `l${index}`)
    const after = [...before]
    after[5] = 'x'
    const shown = compressDiff(diffLines(text(before), text(after)), 1)
      .filter((chunk) => chunk.kind !== 'skip')
      .map((chunk) => `${MARK[chunk.kind]}${chunk.text}`)
    expect(shown).toEqual([' l4', '-l5', '+x', ' l6'])
  })

  it('全部不同时不产生 skip', () => {
    const chunks = compressDiff(diffLines(text(['a', 'b']), text(['c', 'd'])))
    expect(chunks.every((chunk) => chunk.kind !== 'skip')).toBe(true)
  })

  it('超大改动量走整块替换而不做逐行配对', () => {
    const size = 2001
    const before = Array.from({ length: size }, (_, index) => `old-${index}`)
    const after = Array.from({ length: size }, (_, index) => `new-${index}`)
    const summary = summarize(diffLines(text(before), text(after)))
    expect(summary).toEqual({ added: size, removed: size, changed: true })
  })
})
