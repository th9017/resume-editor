import { describe, expect, it } from 'vitest'
import { insertPosition, moveTarget } from '../src/core/dragSort'

describe('drag sort', () => {
  it('按指针位置决定插入点', () => {
    expect(insertPosition(10, 0, 40, 2)).toBe(2)
    expect(insertPosition(30, 0, 40, 2)).toBe(3)
    expect(insertPosition(20, 0, 40, 2)).toBe(2)
  })

  it('向下移动时插入点需要扣除被移除的一项', () => {
    expect(moveTarget(0, 2, 5)).toBe(1)
    expect(moveTarget(1, 3, 5)).toBe(2)
  })

  it('向上移动时插入点即目标下标', () => {
    expect(moveTarget(3, 0, 5)).toBe(0)
    expect(moveTarget(3, 2, 5)).toBe(2)
  })

  it('落回原位与越界都返回 null', () => {
    expect(moveTarget(2, 2, 5)).toBeNull()
    expect(moveTarget(2, 3, 5)).toBeNull()
    expect(moveTarget(5, 1, 5)).toBeNull()
    expect(moveTarget(-1, 1, 5)).toBeNull()
    expect(moveTarget(0, 6, 5)).toBeNull()
    expect(moveTarget(0, Number.NaN, 5)).toBeNull()
  })

  it('单项列表不产生移动', () => {
    expect(moveTarget(0, 0, 1)).toBeNull()
    expect(moveTarget(0, 1, 1)).toBeNull()
  })
})
