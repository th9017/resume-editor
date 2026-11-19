import { describe, expect, it } from 'vitest'
import {
  assetFileName,
  collectImageRefs,
  fileToDataUrl,
  isLocalImageRef,
  resolveImagePath,
} from '../src/core/images'
import { parseResume } from '../src/core/parser'

describe('images', () => {
  it('收集头像、正文与字段中的图片引用并去重', () => {
    const doc = parseResume(`---
name: 张三
avatar: assets/avatar.png
---
:::: summary
## 简介
![正文图](assets/body.png)
::::
:::: experience
::: item
company: A
logo: ![字段图](assets/logo.png)
---
![正文图](assets/body.png)
:::
::::`)
    const refs = collectImageRefs(doc)
    expect(refs).toContain('assets/avatar.png')
    expect(refs).toContain('assets/body.png')
    expect(refs).toContain('assets/logo.png')
    expect(refs.filter((ref) => ref === 'assets/body.png')).toHaveLength(1)
  })

  it('解析相对与绝对图片路径', () => {
    expect(resolveImagePath('C:\\docs\\resume.md', 'assets/a.png')).toBe(
      'C:\\docs\\assets\\a.png',
    )
    expect(resolveImagePath('C:\\docs\\resume.md', 'assets/%E5%A4%B4%E5%83%8F.png')).toBe(
      'C:\\docs\\assets\\头像.png',
    )
    expect(resolveImagePath('C:\\docs\\resume.md', 'D:\\images\\a.png')).toBe('D:\\images\\a.png')
    expect(resolveImagePath('', 'assets/a.png')).toBeNull()
    expect(resolveImagePath('C:\\docs\\resume.md', 'https://example.com/a.png')).toBeNull()
    expect(resolveImagePath('C:\\docs\\resume.md', 'data:image/png;base64,abc')).toBeNull()
    expect(resolveImagePath('C:\\docs\\resume.md', 'file:///C:/a.png')).toBeNull()
  })

  it('识别本地图片引用', () => {
    expect(isLocalImageRef('assets/a.png')).toBe(true)
    expect(isLocalImageRef('C:\\a.png')).toBe(true)
    expect(isLocalImageRef('https://example.com/a.png')).toBe(false)
    expect(isLocalImageRef('data:image/png;base64,abc')).toBe(false)
    expect(isLocalImageRef('file:///C:/a.png')).toBe(false)
  })

  it('读取字节并生成 data URL', async () => {
    const reader = async (): Promise<Uint8Array> => new Uint8Array([1, 2, 3])
    expect(await fileToDataUrl('C:\\a.png', reader)).toBe('data:image/png;base64,AQID')
    expect(await fileToDataUrl('C:\\a.jpg', reader)).toBe('data:image/jpeg;base64,AQID')
    expect(await fileToDataUrl('C:\\a.webp', reader)).toBe('data:image/webp;base64,AQID')
  })

  it('生成带时间戳与随机后缀的资源文件名', () => {
    expect(assetFileName('img', 'png')).toMatch(/^img-\d{8}-\d{6}-[a-z0-9]{4}\.png$/)
    expect(assetFileName('avatar', 'jpg')).toMatch(/^avatar-\d{8}-\d{6}-[a-z0-9]{4}\.jpg$/)
  })
})