import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'
import { docState } from './document'
import { parseResume } from '../core/parser'
import {
  analyzeSource,
  draftToDoc,
  serializeDraft,
  type DraftSection,
  type ResumeDraft,
} from '../core/draft'
import {
  addDraftItem,
  addDraftSection,
  moveDraftItem,
  moveDraftSection,
  removeDraftItem,
  removeDraftSection,
} from '../core/draftActions'
import type { Diagnostic, ResumeDoc } from '../core/types'

export type EditorMode = 'form' | 'source'
export type ActiveView = 'layout' | 'basic' | string

export const editorState = reactive({
  mode: 'form' as EditorMode,
  activeView: 'basic' as ActiveView,
  sourceWarningOpen: false,
  sourceWarningMessage: '',
  addMenuOpen: false,
})

export const draft: Ref<ResumeDraft | null> = ref(null)
export const formDiagnostics: Ref<Diagnostic[]> = ref([])
export const draftRevision: Ref<number> = ref(0)

const parsedContent = computed(() => parseResume(docState.content))

export const currentDoc: ComputedRef<ResumeDoc> = computed(() => {
  if (editorState.mode === 'form' && draft.value) return draftToDoc(draft.value)
  return parsedContent.value
})

export const sourceDiagnostics = computed(() => parsedContent.value.diagnostics)

export const activeSection = computed<DraftSection | null>(() => {
  if (!draft.value) return null
  if (editorState.activeView === 'layout' || editorState.activeView === 'basic') return null
  return draft.value.sections.find((section) => section.id === editorState.activeView) ?? null
})

let serializeTimer: ReturnType<typeof setTimeout> | null = null

export function loadFromContent(content: string): void {
  const result = analyzeSource(content)
  draft.value = result.draft
  formDiagnostics.value = result.diagnostics
  editorState.mode = 'form'
  editorState.activeView = 'basic'
  editorState.sourceWarningOpen = false
  editorState.addMenuOpen = false
  draftRevision.value += 1
}

export function commitDraft(): void {
  if (!draft.value || editorState.mode !== 'form') return
  const next = serializeDraft(draft.value)
  if (next !== docState.content) docState.content = next
}

export function flushDraft(): void {
  if (serializeTimer) {
    clearTimeout(serializeTimer)
    serializeTimer = null
  }
  commitDraft()
}

export function touchDraft(): void {
  if (editorState.mode !== 'form' || !draft.value) return
  draftRevision.value += 1
  if (serializeTimer) clearTimeout(serializeTimer)
  serializeTimer = setTimeout(() => {
    serializeTimer = null
    commitDraft()
  }, 100)
}

export function enterSourceMode(): void {
  if (editorState.mode === 'source') return
  flushDraft()
  editorState.mode = 'source'
}

export function requestSourceSwitch(): void {
  const result = analyzeSource(docState.content)
  if (result.diagnostics.length > 0) {
    const visible = result.diagnostics
      .slice(0, 8)
      .map((item) => `L${item.line} ${item.message}`)
      .join('\n')
    const more =
      result.diagnostics.length > 8 ? `\n… 另有 ${result.diagnostics.length - 8} 条` : ''
    editorState.sourceWarningMessage = visible + more
    editorState.sourceWarningOpen = true
    return
  }
  draft.value = result.draft
  formDiagnostics.value = []
  editorState.activeView = 'basic'
  editorState.mode = 'form'
  editorState.sourceWarningOpen = false
  draftRevision.value += 1
}

export function confirmSourceSwitch(): void {
  const result = analyzeSource(docState.content)
  draft.value = result.draft
  formDiagnostics.value = result.diagnostics
  editorState.activeView = 'basic'
  editorState.mode = 'form'
  editorState.sourceWarningOpen = false
  draftRevision.value += 1
}

export function cancelSourceSwitch(): void {
  editorState.sourceWarningOpen = false
}

export function findSection(id: string): DraftSection | null {
  return draft.value?.sections.find((section) => section.id === id) ?? null
}

export function addSection(type: string): void {
  if (!draft.value) return
  const section = addDraftSection(draft.value, type)
  editorState.activeView = section.id
  touchDraft()
}

export function removeSection(id: string): void {
  if (!draft.value) return
  removeDraftSection(draft.value, id)
  if (editorState.activeView === id) editorState.activeView = 'layout'
  touchDraft()
}

export function moveSection(id: string, delta: -1 | 1): void {
  if (!draft.value) return
  moveDraftSection(draft.value, id, delta)
  touchDraft()
}

export function addItem(sectionId: string): void {
  const section = findSection(sectionId)
  if (!section) return
  addDraftItem(section)
  touchDraft()
}

export function removeItem(sectionId: string, itemId: string): void {
  const section = findSection(sectionId)
  if (!section) return
  removeDraftItem(section, itemId)
  touchDraft()
}

export function moveItem(sectionId: string, itemId: string, delta: -1 | 1): void {
  const section = findSection(sectionId)
  if (!section) return
  moveDraftItem(section, itemId, delta)
  touchDraft()
}