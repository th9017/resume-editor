import { normalizeSource, readFrontmatter } from './frontmatter'
import {
  SECTION_META,
  type Diagnostic,
  type Placement,
  type ResumeDoc,
  type ResumeItem,
  type ResumeSection,
  type Severity,
} from './types'

const SECTION_OPEN_RE = /^ {0,3}(:{4,})[ \t]+([a-z][a-z0-9-]*)(?:[ \t]+(side|main))?[ \t]*$/i
const ITEM_OPEN_RE = /^ {0,3}:{3}[ \t]+item[ \t]*$/i
const CLOSE_RE = /^ {0,3}(:{3,})[ \t]*$/
const FIELD_RE = /^ {0,3}([A-Za-z][A-Za-z0-9_-]{0,23}):[ \t]*(.*)$/
const SEP_RE = /^ {0,3}---[ \t]*$/
const TITLE_RE = /^ {0,3}##[ \t]+(.+?)[ \t]*#*[ \t]*$/
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/
const SHORT_SECTION_RE = /^ {0,3}:{3}[ \t]+([a-z][a-z0-9-]*)(?:[ \t]+(side|main))?[ \t]*$/i

interface SectionState {
  section: ResumeSection
  fence: number
  titlePending: boolean
  bodyLines: string[]
}

interface ItemState {
  item: ResumeItem
  phase: 'fields' | 'body'
  bodyLines: string[]
}

export function parseResume(source: string): ResumeDoc {
  const normalized = normalizeSource(source)
  const fmRead = readFrontmatter(normalized)
  const bodyLines = fmRead.body.split('\n')
  const lineOffset = fmRead.bodyStartLine - 1
  const diagnostics: Diagnostic[] = [...fmRead.diagnostics]
  const sections: ResumeSection[] = []
  const preambleLines: string[] = []
  let preambleFirstLine = 0
  let currentSection: SectionState | null = null
  let currentItem: ItemState | null = null
  let fenceChar = ''
  let fenceLength = 0

  const lineNo = (index: number): number => lineOffset + index + 1
  const addDiag = (line: number, severity: Severity, code: string, message: string): void => {
    diagnostics.push({ line, severity, code, message })
  }

  function resolvePendingTitle(): void {
    if (!currentSection?.titlePending) return
    currentSection.section.title = defaultTitle(currentSection.section.type)
    currentSection.titlePending = false
  }

  function appendLine(line: string, index: number): void {
    if (currentItem) {
      currentItem.bodyLines.push(line)
      return
    }
    if (currentSection) {
      if (currentSection.titlePending) {
        if (line.trim() === '') return
        const match = TITLE_RE.exec(line)
        if (match) {
          currentSection.section.title = match[1].trim()
          currentSection.titlePending = false
          return
        }
        currentSection.section.title = defaultTitle(currentSection.section.type)
        currentSection.titlePending = false
      }
      currentSection.bodyLines.push(line)
      return
    }
    if (preambleFirstLine === 0 && line.trim() !== '') preambleFirstLine = lineNo(index)
    preambleLines.push(line)
  }

  function closeItem(endLine: number): void {
    if (!currentItem) return
    currentItem.item.body = trimBlank(currentItem.bodyLines.join('\n'))
    currentItem.item.endLine = Math.max(currentItem.item.line, endLine)
    currentItem = null
  }

  function closeSection(endLine: number): void {
    if (!currentSection) return
    if (currentItem) closeItem(endLine)
    resolvePendingTitle()
    currentSection.section.body = trimBlank(currentSection.bodyLines.join('\n'))
    currentSection.section.endLine = Math.max(currentSection.section.line, endLine)
    currentSection = null
  }

  function openSection(type: string, placement: Placement, fence: number, index: number): void {
    const line = lineNo(index)
    if (type === 'item' || type === 'end') {
      addDiag(line, 'warn', 'SEC_RESERVED', `章节名 ${type} 是保留字，已忽略该行`)
      return
    }
    if (currentItem) {
      closeItem(line - 1)
      addDiag(line, 'warn', 'ITEM_IMPLICIT_CLOSE', '上一个条目未显式闭合，已在新章节开始前结束')
    }
    if (currentSection) {
      closeSection(line - 1)
      addDiag(line, 'warn', 'SEC_IMPLICIT_CLOSE', '上一个章节未显式闭合，已自动结束')
    }

    const meta = SECTION_META[type]
    if (!meta) addDiag(line, 'warn', 'SEC_UNKNOWN', `未知章节类型 ${type}，已按自定义章节渲染`)

    const section: ResumeSection = {
      type,
      title: meta?.label ?? defaultTitle(type),
      placement,
      body: '',
      items: [],
      line,
      endLine: line,
    }
    sections.push(section)
    currentSection = { section, fence, titlePending: true, bodyLines: [] }
  }

  function openItem(index: number): void {
    const line = lineNo(index)
    if (currentItem) {
      closeItem(line - 1)
      addDiag(line, 'warn', 'ITEM_IMPLICIT_CLOSE', '上一个条目未显式闭合，已自动结束')
    }
    if (!currentSection) {
      addDiag(line, 'warn', 'ITEM_OUTSIDE', '条目不在章节内，已自动包裹为自定义章节')
      const section: ResumeSection = {
        type: 'custom',
        title: '未命名条目',
        placement: 'auto',
        body: '',
        items: [],
        line,
        endLine: line,
      }
      sections.push(section)
      currentSection = { section, fence: 4, titlePending: false, bodyLines: [] }
    } else if (currentSection.titlePending) {
      currentSection.section.title = defaultTitle(currentSection.section.type)
      currentSection.titlePending = false
    }

    const item: ResumeItem = { fields: {}, body: '', line, endLine: line }
    currentSection.section.items.push(item)
    currentItem = { item, phase: 'fields', bodyLines: [] }
  }

  function handleItemLine(line: string, index: number): void {
    if (!currentItem) return
    if (currentItem.phase === 'fields') {
      if (line.trim() === '') return
      if (SEP_RE.test(line)) {
        currentItem.phase = 'body'
        return
      }
      const match = FIELD_RE.exec(line)
      if (match) {
        const key = match[1].toLowerCase()
        const value = match[2].trim()
        if (Object.prototype.hasOwnProperty.call(currentItem.item.fields, key)) {
          addDiag(lineNo(index), 'warn', 'FIELD_DUP', `字段 ${key} 重复，后者覆盖前者`)
        }
        currentItem.item.fields[key] = value
        const meta = currentSection ? SECTION_META[currentSection.section.type] : undefined
        if (meta && !meta.fields.includes(key)) {
          addDiag(lineNo(index), 'info', 'FIELD_UNKNOWN', `未知字段 ${key}，将作为附加信息显示`)
        }
        return
      }
      currentItem.phase = 'body'
      currentItem.bodyLines.push(line)
      return
    }
    currentItem.bodyLines.push(line)
  }

  function handleClose(fence: number, index: number): void {
    const line = lineNo(index)
    if (!currentSection) {
      addDiag(line, 'warn', 'STRAY_CLOSE', '多余的闭合围栏，已忽略')
      return
    }
    if (currentItem) {
      if (fence === 3) {
        closeItem(line)
        return
      }
      if (fence >= currentSection.fence) {
        closeItem(line)
        addDiag(line, 'warn', 'ITEM_IMPLICIT_CLOSE', '章节闭合时条目未闭合，已自动结束')
        closeSection(line)
        return
      }
      addDiag(line, 'warn', 'FENCE_MISMATCH', '闭合围栏长度与当前条目不匹配，已忽略')
      return
    }
    if (fence >= currentSection.fence) {
      closeSection(line)
      return
    }
    addDiag(line, 'warn', 'FENCE_MISMATCH', '章节闭合需要至少 4 个冒号，已忽略')
  }

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i]

    if (fenceChar) {
      appendLine(line, i)
      if (isFenceClose(line, fenceChar, fenceLength)) {
        fenceChar = ''
        fenceLength = 0
      }
      continue
    }

    const fenceMatch = FENCE_OPEN_RE.exec(line)
    if (fenceMatch) {
      appendLine(line, i)
      fenceChar = fenceMatch[1][0]
      fenceLength = fenceMatch[1].length
      continue
    }

    const closeMatch = CLOSE_RE.exec(line)
    if (closeMatch) {
      handleClose(closeMatch[1].length, i)
      continue
    }

    if (ITEM_OPEN_RE.test(line)) {
      openItem(i)
      continue
    }

    const sectionMatch = SECTION_OPEN_RE.exec(line)
    if (sectionMatch) {
      const placement = (sectionMatch[3]?.toLowerCase() as Placement | undefined) ?? 'auto'
      openSection(sectionMatch[2].toLowerCase(), placement, sectionMatch[1].length, i)
      continue
    }

    if (SHORT_SECTION_RE.test(line)) {
      addDiag(
        lineNo(i),
        'warn',
        'SEC_OPEN_TOO_SHORT',
        '章节容器需要 4 个冒号（::::），该行已按正文处理',
      )
    }

    if (currentItem) handleItemLine(line, i)
    else appendLine(line, i)
  }

  const lastLine = Math.max(1, lineOffset + bodyLines.length)
  if (currentItem) {
    closeItem(lastLine)
    addDiag(lastLine, 'warn', 'ITEM_UNCLOSED', '条目未闭合，已在文末自动结束')
  }
  if (currentSection) {
    closeSection(lastLine)
    addDiag(lastLine, 'warn', 'SEC_UNCLOSED', '章节未闭合，已在文末自动结束')
  }

  const preamble = trimBlank(preambleLines.join('\n'))
  if (preamble) {
    addDiag(preambleFirstLine || 1, 'info', 'PREAMBLE', '章节外的正文将渲染在简历顶部')
  }

  diagnostics.sort((a, b) => a.line - b.line)

  return {
    identity: fmRead.identity,
    style: fmRead.style,
    preamble,
    sections,
    diagnostics,
    source: normalized,
    frontmatter: fmRead.fm,
  }
}

function defaultTitle(type: string): string {
  return (
    SECTION_META[type]?.label ??
    type.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
  )
}

function trimBlank(value: string): string {
  return value.replace(/^(?:[ \t]*\n)+/, '').replace(/[ \t\n]+$/, '')
}

function isFenceClose(line: string, char: string, length: number): boolean {
  const ch = char === '`' ? '`' : '~'
  return new RegExp('^ {0,3}' + ch + '{' + length + ',}[ \\t]*$').test(line)
}