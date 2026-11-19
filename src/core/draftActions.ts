import {
  createBlankItem,
  createBlankSection,
  type DraftSection,
  type ResumeDraft,
} from './draft'

export function addDraftSection(draft: ResumeDraft, type: string): DraftSection {
  const section = createBlankSection(type)
  draft.sections.push(section)
  return section
}

export function removeDraftSection(draft: ResumeDraft, id: string): void {
  draft.sections = draft.sections.filter((section) => section.id !== id)
}

export function moveDraftSection(draft: ResumeDraft, id: string, delta: -1 | 1): void {
  const index = draft.sections.findIndex((section) => section.id === id)
  const next = index + delta
  if (index < 0 || next < 0 || next >= draft.sections.length) return
  const [section] = draft.sections.splice(index, 1)
  draft.sections.splice(next, 0, section)
}

export function addDraftItem(section: DraftSection): void {
  section.items.push(createBlankItem(section.type))
}

export function removeDraftItem(section: DraftSection, itemId: string): void {
  section.items = section.items.filter((item) => item.id !== itemId)
}

export function moveDraftItem(section: DraftSection, itemId: string, delta: -1 | 1): void {
  const index = section.items.findIndex((item) => item.id === itemId)
  const next = index + delta
  if (index < 0 || next < 0 || next >= section.items.length) return
  const [item] = section.items.splice(index, 1)
  section.items.splice(next, 0, item)
}

export function addDraftBullet(target: { bullets: string[] }, afterIndex = -1): void {
  target.bullets.splice(afterIndex + 1, 0, '')
}

export function removeDraftBullet(target: { bullets: string[] }, index: number): void {
  target.bullets.splice(index, 1)
}

export function moveDraftBullet(target: { bullets: string[] }, index: number, delta: -1 | 1): void {
  const next = index + delta
  if (next < 0 || next >= target.bullets.length) return
  const [bullet] = target.bullets.splice(index, 1)
  target.bullets.splice(next, 0, bullet)
}