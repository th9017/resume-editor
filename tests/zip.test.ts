import { describe, expect, it } from 'vitest'
import { isZip, listZipEntries, readZipText } from '../src/core/zip'
import { buildZip } from './support/zipFixture'

const LOREM = 'Word 文档正文，包含中文、英文和符号 <> & "quote"。'.repeat(40)

describe('zip 读取', () => {
  it('识别 ZIP 魔数', () => {
    expect(isZip(buildZip([{ name: 'a.txt', content: 'hi' }]))).toBe(true)
    expect(isZip(new TextEncoder().encode('%PDF-1.4'))).toBe(false)
    expect(isZip(new Uint8Array(0))).toBe(false)
  })

  it('从中央目录列出条目', () => {
    const zip = buildZip([
      { name: '[Content_Types].xml', content: '<Types/>' },
      { name: '_rels/.rels', content: '<Relationships/>' },
      { name: 'word/document.xml', content: '<w:document/>', deflate: true },
    ])
    expect(listZipEntries(zip).map((entry) => entry.name)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
    ])
  })

  it('stored 与 deflate 条目都能读回原文', async () => {
    const zip = buildZip([
      { name: 'stored.txt', content: LOREM },
      { name: 'deflated.txt', content: LOREM, deflate: true },
    ])
    expect(await readZipText(zip, 'stored.txt')).toBe(LOREM)
    expect(await readZipText(zip, 'deflated.txt')).toBe(LOREM)
  })

  it('本地头缺长度字段、带 extra 和尾部注释时仍能定位数据', async () => {
    const zip = buildZip(
      [
        { name: 'plain.txt', content: 'first', deflate: true },
        {
          name: 'streamed.txt',
          content: LOREM,
          deflate: true,
          dataDescriptor: true,
          localExtra: 'EXTRA',
        },
      ],
      'made by vitest',
    )
    expect(await readZipText(zip, 'streamed.txt')).toBe(LOREM)
    expect(await readZipText(zip, 'plain.txt')).toBe('first')
  })

  it('条目不存在时返回 null', async () => {
    const zip = buildZip([{ name: 'a.txt', content: 'a' }])
    expect(await readZipText(zip, 'word/document.xml')).toBeNull()
  })

  it('不是 ZIP 时给出可读错误', async () => {
    const bytes = new TextEncoder().encode('<?xml version="1.0"?><html></html>')
    expect(() => listZipEntries(bytes)).toThrow('ZIP')
    await expect(readZipText(bytes, 'x')).rejects.toThrow('ZIP')
  })
})
