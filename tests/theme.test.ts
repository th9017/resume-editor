import { describe, expect, it } from 'vitest'
import { isThemePreference, resolveTheme, THEME_OPTIONS } from '../src/core/theme'

describe('theme preference', () => {
  it('手动偏好覆盖系统', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('跟随系统时由系统决定', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('只接受已定义三种偏好', () => {
    expect(THEME_OPTIONS.map((option) => option.value)).toEqual(['system', 'light', 'dark'])
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('auto')).toBe(false)
    expect(isThemePreference(undefined)).toBe(false)
  })
})
