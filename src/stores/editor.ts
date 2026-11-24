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
  canRedoEdit,
  canUndoEdit,
  createUndoStack,
  recordEdit,
  redoEdit,
  resetStack,
  undoEdit,
} from '../core/history'
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
export const formHistory = reactive(createUndoStack())

export const canUndo = computed(() => editorState.mode === 'form' && canUndoEdit(formHistory))
export const canRedo = computed(() => editorState.mode === 'form' && canRedoEdit(formHistory))

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

function draftSnapshot(): string {
  return draft.value ? JSON.stringify(draft.value) : ''
}

function scheduleCommit(): void {
  if (serializeTimer) clearTimeout(serializeTimer)
  serializeTimer = setTimeout(() => {
    serializeTimer = null
    commitDraft()
  }, 100)
}

/** 载入新内容后历史从零开始，避免撤销跨文档 */
function startHistory(): void {
  resetStack(formHistory, draftSnapshot())
}

function keepHistory(label: string, coalesce: boolean): void {
  recordEdit(formHistory, draftSnapshot(), label, Date.now(), coalesce)
}

function ensureActiveView(): void {
  const view = editorState.activeView
  if (view === 'layout' || view === 'basic') return
  if (draft.value?.sections.some((section) => section.id === view)) return
  editorState.activeView = draft.value?.sections.length ? 'layout' : 'basic'
}

export function loadFromContent(content: string): void {
  const result = analyzeSource(content)
  draft.value = result.draft
  formDiagnostics.value = result.diagnostics
  editorState.mode = 'form'
  editorState.activeView = 'basic'
  editorState.sourceWarningOpen = false
  editorState.addMenuOpen = false
  draftRevision.value += 1
  startHistory()
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

/** 文本类编辑：同一字段在时间窗内的连续输入合并为一次撤销 */
export function touchDraft(label = 'text'): void {
  if (editorState.mode !== 'form' || !draft.value) return
  draftRevision.value += 1
  keepHistory(label, true)
  scheduleCommit()
}

/** 增删、排序、样式切换等离散操作：每步独立可撤销 */
export function structuralEdit(label: string): void {
  if (editorState.mode !== 'form' || !draft.value) return
  draftRevision.value += 1
  keepHistory(label, false)
  scheduleCommit()
}

function restoreSnapshot(snapshot: string): void {
  if (!snapshot) return
  draft.value = JSON.parse(snapshot) as ResumeDraft
  ensureActiveView()
  draftRevision.value += 1
  scheduleCommit()
}

export function undoFormEdit(): boolean {
  if (editorState.mode !== 'form' || !draft.value) return false
  const snapshot = undoEdit(formHistory)
  if (snapshot === null) return false
  restoreSnapshot(snapshot)
  return true
}

export function redoFormEdit(): boolean {
  if (editorState.mode !== 'form' || !draft.value) return false
  const snapshot = redoEdit(formHistory)
  if (snapshot === null) return false
  restoreSnapshot(snapshot)
  return true
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
  startHistory()
}

export function confirmSourceSwitch(): void {
  const result = analyzeSource(docState.content)
  draft.value = result.draft
  formDiagnostics.value = result.diagnostics
  editorState.activeView = 'basic'
  editorState.mode = 'form'
  editorState.sourceWarningOpen = false
  draftRevision.value += 1
  startHistory()
}

export function cancelSourceSwitch(): void {
  editorState.sourceWarningOpen = false
}

export function findSection(id: string): DraftSection | null {
  return draft.value?.sections.find((section) => section.id === id) ?? null
}

function withHistory(label: string, mutate: (current: ResumeDraft) => void): void {
  const current = draft.value
  if (editorState.mode !== 'form' || !current) return
  mutate(current)
  draftRevision.value += 1
  keepHistory(label, false)
  scheduleCommit()
}

export function addSection(type: string): void {
  withHistory(`add-section:${type}`, (current) => {
    editorState.activeView = addDraftSection(current, type).id
  })
  ensureActiveView()
}

export function removeSection(id: string): void {
  withHistory(`remove-section:${id}`, (current) => {
    removeDraftSection(current, id)
    if (editorState.activeView === id) editorState.activeView = 'layout'
  })
  ensureActiveView()
}

export function moveSection(id: string, delta: -1 | 1): void {
  withHistory(`move-section:${id}`, (current) => moveDraftSection(current, id, delta))
}

export function addItem(sectionId: string): void {
  const section = findSection(sectionId)
  if (!section) return
  withHistory(`add-item:${sectionId}`, () => addDraftItem(section))
}

export function removeItem(sectionId: string, itemId: string): void {
  const section = findSection(sectionId)
  if (!section) return
  withHistory(`remove-item:${itemId}`, () => removeDraftItem(section, itemId))
}

export function moveItem(sectionId: string, itemId: string, delta: -1 | 1): void {
  const section = findSection(sectionId)
  if (!section) return
  withHistory(`move-item:${itemId}`, () => moveDraftItem(section, itemId, delta))
}

/** 拖拽排序：整次拖放折叠为一步撤销 */
export function reorderSections(from: number, to: number): void {
  const current = draft.value
  if (!current || !movable(from, to, current.sections.length)) return
  withHistory('reorder-sections', (target) => {
    target.sections.splice(to, 0, target.sections.splice(from, 1)[0])
  })
}

export function reorderItems(sectionId: string, from: number, to: number): void {
  const section = findSection(sectionId)
  if (!section || !movable(from, to, section.items.length)) return
  withHistory(`reorder-items:${sectionId}`, () => {
    section.items.splice(to, 0, section.items.splice(from, 1)[0])
  })
}

function movable(from: number, to: number, length: number): boolean {
  return (
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from !== to &&
    from >= 0 &&
    from < length &&
    to >= 0 &&
    to < length
  )
}