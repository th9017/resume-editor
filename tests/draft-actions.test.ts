import { describe, expect, it } from 'vitest'
import { createBlankSection, type ResumeDraft } from '../src/core/draft'
import {
  addDraftBullet,
  addDraftItem,
  moveDraftBullet,
  moveDraftItem,
  moveDraftSection,
  removeDraftItem,
  removeDraftSection,
} from '../src/core/draftActions'
import { DEFAULT_STYLE } from '../src/core/types'

describe('draft actions', () => {
  it('章节/条目/要点的增删与移动', () => {
    const draft: ResumeDraft = {
      identity: { name: '', title: '', contacts: [], avatar: '' },
      style: { ...DEFAULT_STYLE },
      sections: [],
    }
    const a = createBlankSection('experience')
    const b = createBlankSection('education')
    const firstItem = a.items[0]
    draft.sections.push(a, b)

    moveDraftSection(draft, b.id, -1)
    expect(draft.sections[0].id).toBe(b.id)
    removeDraftSection(draft, b.id)
    expect(draft.sections).toHaveLength(1)

    addDraftItem(a)
    const secondItem = a.items[1]
    expect(a.items).toHaveLength(2)
    moveDraftItem(a, secondItem.id, -1)
    expect(a.items[0].id).toBe(secondItem.id)
    expect(a.items[1].id).toBe(firstItem.id)
    removeDraftItem(a, secondItem.id)
    expect(a.items).toHaveLength(1)

    a.items[0].bullets = ['第一条', '第二条']
    addDraftBullet(a.items[0], 0)
    expect(a.items[0].bullets).toEqual(['第一条', '', '第二条'])
    moveDraftBullet(a.items[0], 0, 1)
    expect(a.items[0].bullets).toEqual(['', '第一条', '第二条'])
  })
})