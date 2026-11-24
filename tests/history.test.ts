import { describe, expect, it } from 'vitest'
import {
  canRedoEdit,
  canUndoEdit,
  createUndoStack,
  recordEdit,
  redoEdit,
  resetStack,
  undoEdit,
} from '../src/core/history'

describe('undo stack', () => {
  it('记录后逐级撤销与重做', () => {
    const state = createUndoStack('v0')
    expect(canUndoEdit(state)).toBe(false)
    expect(undoEdit(state)).toBeNull()

    recordEdit(state, 'v1', 'a', 1000)
    recordEdit(state, 'v2', 'b', 2000)
    expect(canUndoEdit(state)).toBe(true)
    expect(undoEdit(state)).toBe('v1')
    expect(undoEdit(state)).toBe('v0')
    expect(canUndoEdit(state)).toBe(false)
    expect(redoEdit(state)).toBe('v1')
    expect(redoEdit(state)).toBe('v2')
    expect(canRedoEdit(state)).toBe(false)
  })

  it('与当前快照相同的记录被忽略', () => {
    const state = createUndoStack('v0')
    expect(recordEdit(state, 'v0', 'a', 1000)).toBe(false)
    expect(canUndoEdit(state)).toBe(false)
  })

  it('同字段的连续输入合并为一次撤销', () => {
    const state = createUndoStack('')
    recordEdit(state, '张', 'name', 1000, true)
    recordEdit(state, '张一', 'name', 1100, true)
    recordEdit(state, '张一鸣', 'name', 1200, true)
    expect(state.past).toEqual([''])
    expect(undoEdit(state)).toBe('')
  })

  it('超过时间窗后不再合并', () => {
    const state = createUndoStack('')
    recordEdit(state, 'a', 'name', 1000, true)
    recordEdit(state, 'ab', 'name', 5000, true)
    expect(state.past).toEqual(['', 'a'])
  })

  it('不同字段即使相邻也不合并', () => {
    const state = createUndoStack('')
    recordEdit(state, 'a', 'name', 1000, true)
    recordEdit(state, 'b', 'title', 1010, true)
    expect(state.past).toEqual(['', 'a'])
  })

  it('结构操作永远独立成步，并打断输入合并链', () => {
    const state = createUndoStack('')
    recordEdit(state, 'typed', 'name', 1000, true)
    recordEdit(state, 'with-section', 'add-section', 1010)
    recordEdit(state, 'typed-again', 'name', 1020, true)
    expect(state.past).toEqual(['', 'typed', 'with-section'])
  })

  it('新的编辑会清空重做栈', () => {
    const state = createUndoStack('v0')
    recordEdit(state, 'v1', 'a', 1000)
    undoEdit(state)
    expect(canRedoEdit(state)).toBe(true)
    recordEdit(state, 'v2', 'b', 2000)
    expect(canRedoEdit(state)).toBe(false)
  })

  it('超出上限时丢弃最旧记录', () => {
    const state = createUndoStack('v0', { limit: 3 })
    for (let index = 1; index <= 5; index += 1) recordEdit(state, `v${index}`, `k${index}`, index * 1000)
    expect(state.past).toEqual(['v2', 'v3', 'v4'])
    expect(state.present).toBe('v5')
  })

  it('重置栈会清空历史并以新快照为基准', () => {
    const state = createUndoStack('v0')
    recordEdit(state, 'v1', 'a', 1000)
    undoEdit(state)
    resetStack(state, 'fresh')
    expect(state.past).toEqual([])
    expect(state.future).toEqual([])
    expect(state.present).toBe('fresh')
    expect(canUndoEdit(state)).toBe(false)
    expect(canRedoEdit(state)).toBe(false)
  })
})
