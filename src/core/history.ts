export interface UndoStack {
  past: string[]
  present: string
  future: string[]
  lastLabel: string
  lastAt: number
  limit: number
  coalesceWindowMs: number
}

export interface UndoStackOptions {
  limit?: number
  coalesceWindowMs?: number
}

const DEFAULT_LIMIT = 80
const DEFAULT_COALESCE_MS = 900

export function createUndoStack(present = '', options: UndoStackOptions = {}): UndoStack {
  return {
    past: [],
    present,
    future: [],
    lastLabel: '',
    lastAt: 0,
    limit: options.limit ?? DEFAULT_LIMIT,
    coalesceWindowMs: options.coalesceWindowMs ?? DEFAULT_COALESCE_MS,
  }
}

export function resetStack(state: UndoStack, present: string): void {
  state.past = []
  state.present = present
  state.future = []
  state.lastLabel = ''
  state.lastAt = 0
}

/**
 * coalesce 用于连续输入：同一 label 且落在时间窗内时只更新 present，
 * 让"打完一句话"成为一次撤销而不是一个字符一次。
 */
export function recordEdit(
  state: UndoStack,
  snapshot: string,
  label: string,
  at: number,
  coalesce = false,
): boolean {
  if (snapshot === state.present) return false
  const merged =
    coalesce && label !== '' && label === state.lastLabel && at - state.lastAt < state.coalesceWindowMs
  if (!merged) {
    state.past.push(state.present)
    if (state.past.length > state.limit) state.past.splice(0, state.past.length - state.limit)
    state.future = []
  }
  state.present = snapshot
  state.lastLabel = coalesce ? label : ''
  state.lastAt = at
  return true
}

export function undoEdit(state: UndoStack): string | null {
  if (state.past.length === 0) return null
  state.future.push(state.present)
  if (state.future.length > state.limit) state.future.splice(0, state.future.length - state.limit)
  state.present = state.past.pop() ?? ''
  state.lastLabel = ''
  return state.present
}

export function redoEdit(state: UndoStack): string | null {
  if (state.future.length === 0) return null
  state.past.push(state.present)
  state.present = state.future.pop() ?? ''
  state.lastLabel = ''
  return state.present
}

export function canUndoEdit(state: UndoStack): boolean {
  return state.past.length > 0
}

export function canRedoEdit(state: UndoStack): boolean {
  return state.future.length > 0
}
