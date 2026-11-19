import { SECTION_META } from './types'

export interface Snippet {
  text: string
  cursorOffset: number
}

const CURSOR = '{{cursor}}'

function finish(raw: string): Snippet {
  const index = raw.indexOf(CURSOR)
  const text = raw.replace(CURSOR, '')
  return { text, cursorOffset: index < 0 ? text.length : index }
}

export function sectionSnippet(type: string): Snippet {
  const label = SECTION_META[type]?.label ?? type
  return finish(`\n\n:::: ${type}\n## ${label}\n\n${CURSOR}\n::::\n`)
}

export function itemSnippet(type: string): Snippet {
  const fields = SECTION_META[type]?.fields ?? []
  const keys = fields.length > 0 ? fields : ['title']
  const lines = keys.map((key, index) => `${key}: ${index === 0 ? CURSOR : ''}`)
  return finish(`\n::: item\n${lines.join('\n')}\n---\n- \n:::\n`)
}

export function identitySnippet(): Snippet {
  return finish(
    `---\nname: ${CURSOR}\ntitle: \ncontact:\n  phone: ""\n  email: ""\n  location: ""\n---\n\n`,
  )
}

export function sectionWithItemSnippet(type: string): Snippet {
  const label = SECTION_META[type]?.label ?? type
  const fields = SECTION_META[type]?.fields ?? []
  const keys = fields.length > 0 ? fields : ['title']
  const fieldLines = keys.map((key, index) => `${key}: ${index === 0 ? CURSOR : ''}`)
  return finish(
    `\n\n:::: ${type}\n## ${label}\n\n::: item\n${fieldLines.join('\n')}\n---\n- \n:::\n::::\n`,
  )
}