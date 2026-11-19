import { computed, reactive, watch } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { collectImageRefs, resolveImagePath } from '../core/images'
import { baseName, isAbsolutePath, parentDir, sanitizeFileName } from '../core/paths'
import { parseResume } from '../core/parser'
import {
  loadRecent,
  pushRecent,
  removeRecent,
  saveRecent,
  updateRecentName,
  type RecentFile,
  type StorageLike,
} from '../core/recent'
import { STARTER_MARKDOWN } from '../samples/starter'
import {
  ensureDir,
  fileExists,
  fileMtime,
  pickMarkdownFile,
  pickSavePath,
  readBinaryFile,
  readTextFile,
  writeBinaryFile,
  writeTextFile,
} from '../tauri'

export type ConfirmDecision = 'save' | 'discard' | 'cancel'
export interface ToastMessage {
  text: string
  kind: 'info' | 'error'
}

const storage: StorageLike | null =
  typeof localStorage !== 'undefined' ? localStorage : null
const AUTO_SAVE_KEY = 'resume.autoSave.v1'

export const docState = reactive({
  path: '',
  content: STARTER_MARKDOWN,
  savedContent: STARTER_MARKDOWN,
  mtime: null as number | null,
  lastSavedAt: '',
})

export const appState = reactive({
  recent: loadRecent(storage) as RecentFile[],
  autoSave: loadAutoSave(),
  toast: null as ToastMessage | null,
})

export const dirty = computed(() => docState.content !== docState.savedContent)

export const documentName = computed(() => {
  const parsed = parseResume(docState.content)
  const fromName = parsed.identity.name
  const fromPath = docState.path
    ? baseName(docState.path).replace(/\.(md|markdown)$/i, '')
    : ''
  return fromName || fromPath || '未命名简历'
})

export const confirmState = reactive({
  open: false,
  message: '',
  resolve: null as ((decision: ConfirmDecision) => void) | null,
})

let toastTimer: ReturnType<typeof setTimeout> | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let saving = false
let closeBound = false
let beforeCloseHook: (() => void) | null = null

export function setBeforeCloseHook(hook: (() => void) | null): void {
  beforeCloseHook = hook
}

export function showToast(text: string, kind: 'info' | 'error' = 'info'): void {
  appState.toast = { text, kind }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    appState.toast = null
    toastTimer = null
  }, 3500)
}

export function requestDecision(message: string): Promise<ConfirmDecision> {
  if (confirmState.resolve) confirmState.resolve('cancel')
  confirmState.message = message
  confirmState.open = true
  return new Promise((resolve) => {
    confirmState.resolve = resolve
  })
}

export function resolveDecision(decision: ConfirmDecision): void {
  const resolve = confirmState.resolve
  confirmState.open = false
  confirmState.resolve = null
  resolve?.(decision)
}

export async function saveDocument(options: { silent?: boolean } = {}): Promise<boolean> {
  if (!docState.path) return await saveDocumentAs(options)
  if (saving) return false
  saving = true
  cancelAutoSave()
  const content = docState.content
  try {
    await writeTextFile(docState.path, content)
    docState.savedContent = content
    docState.mtime = await fileMtime(docState.path)
    docState.lastSavedAt = nowLabel()
    updateRecentForPath(docState.path, content)
    void refreshWindowTitle()
    if (!options.silent) showToast('已保存')
    return true
  } catch (error) {
    showToast(`保存失败：${messageOf(error)}`, 'error')
    return false
  } finally {
    saving = false
  }
}

export async function saveDocumentAs(options: { silent?: boolean } = {}): Promise<boolean> {
  if (saving) return false
  cancelAutoSave()
  const parsed = parseResume(docState.content)
  const suggested = `${sanitizeFileName(parsed.identity.name || '我的简历')}.md`
  let target: string | null = null
  try {
    target = await pickSavePath(suggested, docState.path || undefined)
  } catch (error) {
    showToast(`无法打开保存对话框：${messageOf(error)}`, 'error')
    return false
  }
  if (!target) return false
  const finalPath = /\.(md|markdown)$/i.test(target) ? target : `${target}.md`
  const previousPath = docState.path
  saving = true
  const content = docState.content
  try {
    await writeTextFile(finalPath, content)
    docState.path = finalPath
    docState.savedContent = content
    docState.mtime = await fileMtime(finalPath)
    docState.lastSavedAt = nowLabel()
    addRecent(finalPath, content)
    void refreshWindowTitle()
    const copied = await copyAssetsForSaveAs(previousPath, finalPath, content)
    if (!options.silent) {
      const parts = ['已保存']
      if (copied.copied > 0) parts.push(`复制 ${copied.copied} 张图片`)
      if (copied.skipped > 0) parts.push(`跳过 ${copied.skipped} 张`)
      showToast(parts.join('，'))
    }
    return true
  } catch (error) {
    showToast(`保存失败：${messageOf(error)}`, 'error')
    return false
  } finally {
    saving = false
  }
}

export async function newDocument(): Promise<boolean> {
  beforeCloseHook?.()
  if (!(await ensureSaved())) return false
  cancelAutoSave()
  docState.path = ''
  docState.content = STARTER_MARKDOWN
  docState.savedContent = STARTER_MARKDOWN
  docState.mtime = null
  docState.lastSavedAt = ''
  void refreshWindowTitle()
  showToast('已新建简历')
  return true
}

export async function openDocument(targetPath?: string): Promise<boolean> {
  beforeCloseHook?.()
  if (!(await ensureSaved())) return false
  let target: string | null | undefined = targetPath
  if (!target) {
    try {
      target = await pickMarkdownFile()
    } catch (error) {
      showToast(`无法打开文件对话框：${messageOf(error)}`, 'error')
      return false
    }
  }
  if (!target) return false
  try {
    const content = await readTextFile(target)
    cancelAutoSave()
    docState.path = target
    docState.content = content
    docState.savedContent = content
    docState.mtime = await fileMtime(target)
    docState.lastSavedAt = ''
    addRecent(target, content)
    void refreshWindowTitle()
    showToast('已打开简历')
    return true
  } catch (error) {
    showToast(`打开失败：${messageOf(error)}`, 'error')
    if (targetPath) {
      appState.recent = removeRecent(appState.recent, targetPath)
      persistRecent()
    }
    return false
  }
}

async function ensureSaved(): Promise<boolean> {
  cancelAutoSave()
  if (!dirty.value) return true
  const decision = await requestDecision('当前文档有未保存的修改，是否保存？')
  if (decision === 'cancel') return false
  if (decision === 'discard') return true
  return await saveDocument()
}

export async function refreshWindowTitle(): Promise<void> {
  const title = `${dirty.value ? '● ' : ''}${documentName.value} - 简历编辑器`
  try {
    await getCurrentWindow().setTitle(title)
  } catch {
    /* 浏览器预览环境没有 Tauri 窗口 */
  }
}

export async function bindCloseHandler(): Promise<void> {
  if (closeBound) return
  closeBound = true
  try {
    const windowHandle = getCurrentWindow()
    await windowHandle.onCloseRequested(async (event) => {
      beforeCloseHook?.()
      if (!dirty.value) return
      event.preventDefault()
      const canClose = await ensureSaved()
      if (canClose) await windowHandle.destroy()
    })
  } catch {
    closeBound = false
  }
}

function scheduleAutoSave(): void {
  if (!appState.autoSave || !docState.path) return
  cancelAutoSave()
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null
    void saveDocument({ silent: true })
  }, 800)
}

function cancelAutoSave(): void {
  if (!autoSaveTimer) return
  clearTimeout(autoSaveTimer)
  autoSaveTimer = null
}

function addRecent(path: string, content: string): void {
  if (!path) return
  const name = parseResume(content).identity.name || baseName(path)
  appState.recent = pushRecent(appState.recent, { path, name, at: Date.now() })
  persistRecent()
}

function updateRecentForPath(path: string, content: string): void {
  const name = parseResume(content).identity.name || baseName(path)
  appState.recent = updateRecentName(appState.recent, path, name)
  persistRecent()
}

function persistRecent(): void {
  saveRecent(storage, appState.recent)
}

function loadAutoSave(): boolean {
  try {
    const value = storage?.getItem(AUTO_SAVE_KEY)
    return value == null ? true : value === '1'
  } catch {
    return true
  }
}

interface CopyAssetsResult {
  copied: number
  skipped: number
}

async function copyAssetsForSaveAs(
  previousPath: string,
  nextPath: string,
  content: string,
): Promise<CopyAssetsResult> {
  const none: CopyAssetsResult = { copied: 0, skipped: 0 }
  if (!previousPath || parentDir(previousPath) === parentDir(nextPath)) return none
  const refs = collectImageRefs(parseResume(content)).filter((ref) => !isAbsolutePath(ref))
  if (refs.length === 0) return none
  const confirmed =
    typeof window === 'undefined'
      ? false
      : window.confirm(`检测到 ${refs.length} 张本地图片，是否复制到新目录？`)
  if (!confirmed) return none

  let copied = 0
  let skipped = 0
  for (const ref of refs) {
    const source = resolveImagePath(previousPath, ref)
    const target = resolveImagePath(nextPath, ref)
    if (!source || !target || source === target) continue
    try {
      if (await fileExists(target)) {
        skipped++
        continue
      }
      const bytes = await readBinaryFile(source)
      await ensureDir(parentDir(target))
      await writeBinaryFile(target, bytes)
      copied++
    } catch {
      skipped++
    }
  }
  return { copied, skipped }
}

function nowLabel(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

watch(
  () => docState.content,
  () => {
    if (!appState.autoSave || !docState.path) return
    if (docState.content === docState.savedContent) return
    scheduleAutoSave()
  },
)

watch(
  () => appState.autoSave,
  (value) => {
    try {
      storage?.setItem(AUTO_SAVE_KEY, value ? '1' : '0')
    } catch {
      /* 偏好保存失败时忽略 */
    }
  },
)