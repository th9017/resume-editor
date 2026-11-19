import { describe, expect, it } from 'vitest'
import { searchFit, simulatePages } from '../src/core/fit'

describe('simulatePages', () => {
  it('空内容为一页', () => {
    expect(simulatePages([], 1000).pages).toBe(1)
  })

  it('内容在一页内', () => {
    const pages = simulatePages(
      [
        { top: 0, height: 400 },
        { top: 500, height: 300 },
      ],
      1000,
    ).pages
    expect(pages).toBe(1)
  })

  it('跨页块整体下移', () => {
    const pages = simulatePages(
      [
        { top: 0, height: 900 },
        { top: 950, height: 150 },
      ],
      1000,
    ).pages
    expect(pages).toBe(2)
  })

  it('块间间距计入页高', () => {
    const pages = simulatePages(
      [
        { top: 0, height: 500 },
        { top: 900, height: 200 },
      ],
      1000,
    ).pages
    expect(pages).toBe(2)
  })

  it('超长块允许内部断页', () => {
    expect(simulatePages([{ top: 0, height: 2500 }], 1000).pages).toBe(3)
    expect(
      simulatePages(
        [
          { top: 0, height: 800 },
          { top: 800, height: 2500 },
        ],
        1000,
      ).pages,
    ).toBe(4)
  })
})

describe('searchFit', () => {
  it('本来就是一页时返回 1', async () => {
    expect(await searchFit(async () => 1, 0.85)).toBe(1)
  })

  it('找到临界缩放并向下取整', async () => {
    const fit = await searchFit(async (value) => (value >= 0.92 ? 2 : 1), 0.85)
    expect(fit).toBe(0.91)
  })

  it('下限仍超过一页时返回 null', async () => {
    expect(await searchFit(async () => 2, 0.85)).toBeNull()
  })
})