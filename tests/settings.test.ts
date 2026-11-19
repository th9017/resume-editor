import { describe, expect, it } from 'vitest'
import {
  defaultSettings,
  legacySettingsFrom,
  normalizeSettings,
} from '../src/core/settings'
import type { RecentFile, StorageLike } from '../src/core/recent'

const a: RecentFile = { path: 'C:\\a.md', name: '甲', at: 1 }
const b: RecentFile = { path: 'C:\\b.md', name: '乙', at: 2 }

function memoryStorage(entries: Record<string, string>): StorageLike {
  return {
    getItem(key) {
      return entries[key] ?? null
    },
    setItem(key, value) {
      entries[key] = value
    },
  }
}

describe('settings', () => {
  it('默认设置', () => {
    expect(defaultSettings()).toEqual({
      version: 1,
      recent: [],
      autoSave: true,
      printTipsDismissed: false,
    })
  })

  it('清理非法设置', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings())
    expect(
      normalizeSettings({
        recent: [a, { path: 1 }, b],
        autoSave: 'no',
        printTipsDismissed: 1,
      }),
    ).toEqual({
      version: 1,
      recent: [a, b],
      autoSave: true,
      printTipsDismissed: false,
    })
  })

  it('从旧 localStorage 迁移', () => {
    const storage = memoryStorage({
      'resume.recentFiles.v1': JSON.stringify([a, b]),
      'resume.autoSave.v1': '0',
      'resume.printTipsDismissed.v1': '1',
    })
    expect(legacySettingsFrom(storage)).toEqual({
      version: 1,
      recent: [a, b],
      autoSave: false,
      printTipsDismissed: true,
    })
  })

  it('没有旧存储时使用默认值', () => {
    expect(legacySettingsFrom(null)).toEqual(defaultSettings())
  })
})