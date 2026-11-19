import { describe, expect, it } from 'vitest'
import {
  loadRecent,
  pushRecent,
  removeRecent,
  saveRecent,
  updateRecentName,
  type RecentFile,
  type StorageLike,
} from '../src/core/recent'

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
  }
}

const a: RecentFile = { path: 'C:\\a.md', name: '甲', at: 1 }
const b: RecentFile = { path: 'C:\\b.md', name: '乙', at: 2 }

describe('recent files', () => {
  it('pushRecent 去重置顶并限制数量', () => {
    let items: RecentFile[] = []
    for (let i = 0; i < 10; i++) {
      items = pushRecent(items, { path: `C:\\${i}.md`, name: `${i}`, at: i })
    }
    expect(items).toHaveLength(8)
    expect(items[0].path).toBe('C:\\9.md')
    const again = pushRecent(items, { path: 'C:\\5.md', name: '更新', at: 11 })
    expect(again).toHaveLength(8)
    expect(again[0]).toMatchObject({ path: 'C:\\5.md', name: '更新', at: 11 })
    expect(again.filter((item) => item.path === 'C:\\5.md')).toHaveLength(1)
  })

  it('removeRecent 与 updateRecentName', () => {
    expect(removeRecent([a, b], a.path)).toEqual([b])
    expect(updateRecentName([a, b], a.path, '新名字')[0].name).toBe('新名字')
  })

  it('loadRecent 校验数据结构', () => {
    const storage = memoryStorage()
    storage.setItem('resume.recentFiles.v1', JSON.stringify([a, { path: 1 }, b]))
    expect(loadRecent(storage)).toEqual([a, b])
    storage.setItem('resume.recentFiles.v1', 'not json')
    expect(loadRecent(storage)).toEqual([])
    expect(loadRecent(null)).toEqual([])
  })

  it('saveRecent 写入并截断到 8 条', () => {
    const storage = memoryStorage()
    saveRecent(storage, [a, b])
    expect(loadRecent(storage)).toEqual([a, b])
  })
})