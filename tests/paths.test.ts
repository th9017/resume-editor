import { describe, expect, it } from 'vitest'
import {
  baseName,
  isAbsolutePath,
  joinPath,
  parentDir,
  resolveRelative,
  safeDecode,
} from '../src/core/paths'

describe('paths', () => {
  it('joinPath 兼容反斜杠与正斜杠', () => {
    expect(joinPath('C:\\a', 'b.md')).toBe('C:\\a\\b.md')
    expect(joinPath('C:\\a\\', 'b.md')).toBe('C:\\a\\b.md')
    expect(joinPath('C:/a', 'b.md')).toBe('C:/a/b.md')
    expect(joinPath('C:/a/', 'b.md')).toBe('C:/a/b.md')
    expect(joinPath('', 'b.md')).toBe('b.md')
  })

  it('baseName 与 parentDir', () => {
    expect(baseName('C:\\a\\b.md')).toBe('b.md')
    expect(baseName('C:/a/b.md')).toBe('b.md')
    expect(parentDir('C:\\a\\b.md')).toBe('C:\\a')
    expect(parentDir('C:/a/b.md')).toBe('C:/a')
    expect(parentDir('C:\\b.md')).toBe('C:\\')
    expect(parentDir('b.md')).toBe('')
    expect(parentDir('/a/b.md')).toBe('/a')
  })

  it('识别绝对路径', () => {
    expect(isAbsolutePath('C:\\a')).toBe(true)
    expect(isAbsolutePath('C:/a')).toBe(true)
    expect(isAbsolutePath('\\\\server\\share')).toBe(true)
    expect(isAbsolutePath('/tmp/a')).toBe(true)
    expect(isAbsolutePath('assets/a.png')).toBe(false)
    expect(isAbsolutePath('https://example.com/a.png')).toBe(false)
  })

  it('解析相对路径并解码中文与空格', () => {
    expect(resolveRelative('C:\\docs', 'assets/a.png')).toBe('C:\\docs\\assets\\a.png')
    expect(resolveRelative('C:\\docs', './assets/a.png')).toBe('C:\\docs\\assets\\a.png')
    expect(resolveRelative('C:\\docs', 'assets/%E5%A4%B4%E5%83%8F.png')).toBe(
      'C:\\docs\\assets\\头像.png',
    )
    expect(resolveRelative('C:\\docs', 'assets/a b.png')).toBe('C:\\docs\\assets\\a b.png')
  })

  it('外链、data URL 与绝对路径保持原样', () => {
    expect(resolveRelative('C:\\docs', 'https://example.com/a.png')).toBe(
      'https://example.com/a.png',
    )
    expect(resolveRelative('C:\\docs', 'data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc',
    )
    expect(resolveRelative('C:\\docs', 'D:\\other\\a.png')).toBe('D:\\other\\a.png')
  })

  it('safeDecode 遇到非法编码时回退原字符串', () => {
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A')
    expect(safeDecode('%E5%A4%B4%E5%83%8F')).toBe('头像')
  })
})