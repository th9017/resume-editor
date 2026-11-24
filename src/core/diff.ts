export type DiffKind = 'same' | 'add' | 'del'

export interface DiffLine {
  kind: DiffKind
  text: string
}

export interface DiffChunk {
  kind: DiffKind | 'skip'
  text: string
  count?: number
}

const CELL_LIMIT = 4_000_000

function toLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * 先剥掉首尾相同的行，简历改动通常只集中在几处，
 * 这样中间需要跑 LCS 的部分很小，也避开大文档的内存峰值。
 */
function trimCommon(before: string[], after: string[]): {
  head: number
  tail: number
  middleBefore: string[]
  middleAfter: string[]
} {
  let head = 0
  while (head < before.length && head < after.length && before[head] === after[head]) head += 1
  let tail = 0
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1
  }
  return {
    head,
    tail,
    middleBefore: before.slice(head, before.length - tail),
    middleAfter: after.slice(head, after.length - tail),
  }
}

function lcsDiff(before: string[], after: string[]): DiffLine[] {
  const rows = before.length
  const cols = after.length
  if (rows === 0) return after.map((text) => ({ kind: 'add', text }))
  if (cols === 0) return before.map((text) => ({ kind: 'del', text }))

  const table = new Uint32Array((rows + 1) * (cols + 1))
  const width = cols + 1
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      out.push({ kind: 'same', text: before[i] })
      i += 1
      j += 1
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      out.push({ kind: 'del', text: before[i] })
      i += 1
    } else {
      out.push({ kind: 'add', text: after[j] })
      j += 1
    }
  }
  while (i < rows) out.push({ kind: 'del', text: before[i++] })
  while (j < cols) out.push({ kind: 'add', text: after[j++] })
  return out
}

export function diffLines(before: string, after: string): DiffLine[] {
  const left = toLines(before)
  const right = toLines(after)
  const { head, tail, middleBefore, middleAfter } = trimCommon(left, right)
  const out: DiffLine[] = left.slice(0, head).map((text) => ({ kind: 'same', text }))

  if (middleBefore.length * middleAfter.length > CELL_LIMIT) {
    out.push(...middleBefore.map((text): DiffLine => ({ kind: 'del', text })))
    out.push(...middleAfter.map((text): DiffLine => ({ kind: 'add', text })))
  } else {
    out.push(...lcsDiff(middleBefore, middleAfter))
  }
  out.push(
    ...left
      .slice(left.length - tail, left.length)
      .map((text): DiffLine => ({ kind: 'same', text })),
  )
  return out
}

export interface DiffSummary {
  added: number
  removed: number
  changed: boolean
}

export function summarize(lines: DiffLine[]): DiffSummary {
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.kind === 'add') added += 1
    if (line.kind === 'del') removed += 1
  }
  return { added, removed, changed: added + removed > 0 }
}

/** 相同行只保留上下文，中间折叠成 skip 标记 */
export function compressDiff(lines: DiffLine[], context = 2): DiffChunk[] {
  const keep = new Array<boolean>(lines.length).fill(false)
  lines.forEach((line, index) => {
    if (line.kind !== 'same') {
      for (let offset = -context; offset <= context; offset += 1) {
        const target = index + offset
        if (target >= 0 && target < lines.length) keep[target] = true
      }
    }
  })

  const out: DiffChunk[] = []
  let skipped = 0
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (skipped > 0) {
        out.push({ kind: 'skip', text: '', count: skipped })
        skipped = 0
      }
      out.push({ kind: line.kind, text: line.text })
    } else {
      skipped += 1
    }
  })
  if (skipped > 0) out.push({ kind: 'skip', text: '', count: skipped })
  return out
}
