import { computed, reactive, watch } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { collectImageRefs, resolveImagePath } from '../core/images'
import { compressDiff, diffLines, summarize, type DiffChunk } from '../core/diff'
import { docxToMarkdown } from '../core/docx'
import { importPlainMarkdown, looksLikePlainMarkdown } from '../core/markdownImport'
import {
  baseName,
  copyCandidate,
  isAbsolutePath,
  joinPath,
  parentDir,
  sanitizeFileName,
} from '../core/paths'
import { parseResume } from '../core/parser'
import {
  pushRecent,
  removeRecent,
  updateRecentName,
  type RecentFile,
} from '../core/recent'
import {
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from '../core/settings'
import { resolveTheme, type ThemePreference } from '../core/theme'
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
export type ConfirmValue = ConfirmDecision | 'confirm'

export interface ConfirmButton {
  value: ConfirmValue
  label: string
  variant: 'default' | 'primary' | 'danger'
}

export interface ToastMessage {
  text: string
  kind: 'info' | 'error'
}

export const docState = reactive({
  path: '',
  content: STARTER_MARKDOWN,
  savedContent: STARTER_MARKDOWN,
  mtime: null as number | null,
  lastSavedAt: '',
})

export const appState = reactive({
  recent: [] as RecentFile[],
  autoSave: true,
  printTipsDismissed: false,
  theme: 'system' as ThemePreference,
  directPdf: true,
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
  title: '请确认',
  message: '',
  buttons: [] as ConfirmButton[],
  resolve: null as ((value: ConfirmValue) => void) | null,
})

let toastTimer: ReturnType<typeof setTimeout> | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let settingsTimer: ReturnType<typeof setTimeout> | null = null
let saving = false
let closeBound = false
let beforeCloseHook: (() => void) | null = null

export function setBeforeCloseHook(hook: (() => void) | null): void {
  beforeCloseHook = hook
}

function settingsSnapshot(): AppSettings {
  return {
    version: 1,
    recent: appState.recent,
    autoSave: appState.autoSave,
    printTipsDismissed: appState.printTipsDismissed,
    theme: appState.theme,
    directPdf: appState.directPdf,
  }
}

function persistSettings(): void {
  if (settingsTimer) clearTimeout(settingsTimer)
  settingsTimer = setTimeout(() => {
    settingsTimer = null
    void saveAppSettings(settingsSnapshot())
  }, 200)
}

let darkQuery: MediaQueryList | null = null

/** 主题只作用于应用外壳，简历纸张保持白纸黑字 */
export function applyTheme(): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolveTheme(appState.theme, darkQuery?.matches ?? false)
}

export function setTheme(preference: ThemePreference): void {
  appState.theme = preference
  applyTheme()
  persistSettings()
}

export async function initSettings(): Promise<void> {
  try {
    const settings = await loadAppSettings()
    appState.recent = settings.recent
    appState.autoSave = settings.autoSave
    appState.printTipsDismissed = settings.printTipsDismissed
    appState.theme = settings.theme
    appState.directPdf = settings.directPdf
  } catch {
    /* 设置读取失败时保持默认值 */
  }
  if (typeof matchMedia === 'function') {
    darkQuery = matchMedia('(prefers-color-scheme: dark)')
    darkQuery.addEventListener('change', applyTheme)
  }
  applyTheme()
}

export function setPrintTipsDismissed(): void {
  appState.printTipsDismissed = true
  persistSettings()
}

export function toggleDirectPdf(): void {
  appState.directPdf = !appState.directPdf
  persistSettings()
  showToast(appState.directPdf ? '导出时直接生成 PDF 文件' : '导出时打开系统打印窗口')
}

export function showToast(text: string, kind: 'info' | 'error' = 'info'): void {
  appState.toast = { text, kind }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    appState.toast = null
    toastTimer = null
  }, 3500)
}

const UNSAVED_BUTTONS: ConfirmButton[] = [
  { value: 'cancel', label: '取消', variant: 'default' },
  { value: 'discard', label: '不保存', variant: 'default' },
  { value: 'save', label: '保存', variant: 'primary' },
]

function openConfirm(
  title: string,
  message: string,
  buttons: ConfirmButton[],
): Promise<ConfirmValue> {
  if (confirmState.resolve) confirmState.resolve('cancel')
  confirmState.title = title
  confirmState.message = message
  confirmState.buttons = buttons
  confirmState.open = true
  return new Promise((resolve) => {
    confirmState.resolve = resolve
  })
}

export function requestDecision(message: string): Promise<ConfirmDecision> {
  return openConfirm('未保存的修改', message, UNSAVED_BUTTONS).then((value) =>
    value === 'save' || value === 'discard' || value === 'cancel' ? value : 'cancel',
  )
}

/** 应用内的二次确认，取代原生 window.confirm */
export function askConfirm(
  message: string,
  options: { title?: string; confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const buttons: ConfirmButton[] = [
    { value: 'cancel', label: '取消', variant: 'default' },
    {
      value: 'confirm',
      label: options.confirmLabel ?? '确定',
      variant: options.danger ? 'danger' : 'primary',
    },
  ]
  return openConfirm(options.title ?? '请确认', message, buttons).then(
    (value) => value === 'confirm',
  )
}

export function resolveDecision(value: ConfirmValue): void {
  const resolve = confirmState.resolve
  confirmState.open = false
  confirmState.resolve = null
  confirmState.buttons = []
  resolve?.(value)
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

/** 在当前目录生成一份副本并切换过去编辑，assets/ 相对引用不受影响 */
export async function saveDocumentCopy(): Promise<boolean> {
  if (!docState.path) return await saveDocumentAs()
  const previous = docState.path
  let attempt = 1
  let target = copyCandidate(previous, attempt)
  while (attempt < 30 && (await fileExists(target))) {
    attempt += 1
    target = copyCandidate(previous, attempt)
  }
  if (saving) return false
  cancelAutoSave()
  saving = true
  const content = docState.content
  try {
    await writeTextFile(target, content)
    docState.path = target
    docState.savedContent = content
    docState.mtime = await fileMtime(target)
    docState.lastSavedAt = nowLabel()
    addRecent(target, content)
    void refreshWindowTitle()
    showToast(`已另存副本 ${baseName(target)}`)
    return true
  } catch (error) {
    showToast(`另存副本失败：${messageOf(error)}`, 'error')
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
      target = await pickMarkdownFile({ docx: true })
    } catch (error) {
      showToast(`无法打开文件对话框：${messageOf(error)}`, 'error')
      return false
    }
  }
  if (!target) return false
  try {
    const fromDocx = /\.docx$/i.test(target)
    const content = fromDocx
      ? await importDocx(target)
      : await maybeImportMarkdown(await readTextFile(target))
    const path = fromDocx ? await markdownSibling(target) : target
    cancelAutoSave()
    docState.path = path
    docState.content = content
    docState.savedContent = fromDocx ? '' : content
    docState.mtime = path ? await fileMtime(path) : null
    docState.lastSavedAt = ''
    addRecent(path || target, content)
    void refreshWindowTitle()
    showToast(
      fromDocx
        ? path
          ? 'DOCX 已转换，保存后写入同名 .md'
          : 'DOCX 已转换，请选择保存位置'
        : '已打开简历',
    )
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

/** 普通 Markdown 先问一句，避免静默改写用户文件结构 */
async function maybeImportMarkdown(content: string): Promise<string> {
  if (!looksLikePlainMarkdown(content)) return content
  const ok = await askConfirm(
    '这份文件是普通 Markdown。自动整理可以把「## 工作经历」这类标题映射成可编辑章节，原文不会被删除。\n\n不整理则保留原样。',
    { title: '导入 Markdown', confirmLabel: '自动整理' },
  )
  return ok ? importPlainMarkdown(content) : content
}

async function importDocx(path: string): Promise<string> {
  const markdown = await docxToMarkdown(await readBinaryFile(path))
  const ok = await askConfirm(
    'DOCX 已读出正文并转成 Markdown。自动整理可以把标题映射成可编辑章节。\n\n图片、表格和字体样式不会保留，原 .docx 不会被改写，保存时写入的是 .md 文件。',
    { title: '导入 DOCX', confirmLabel: '自动整理' },
  )
  return ok ? importPlainMarkdown(markdown) : markdown
}

/** 同目录同名 .md；若已存在则留空，交给保存对话框，避免覆盖别的简历 */
async function markdownSibling(path: string): Promise<string> {
  const candidate = joinPath(parentDir(path), `${baseName(path).replace(/\.docx$/i, '')}.md`)
  return (await fileExists(candidate)) ? '' : candidate
}

export const diffState = reactive({
  open: false,
  path: '',
  chunks: [] as DiffChunk[],
  added: 0,
  removed: 0,
})

/** 把当前文档与另一份 .md 做行级对比，当前文档作为基准 */
export async function compareWithFile(): Promise<void> {
  let target: string | null = null
  try {
    target = await pickMarkdownFile()
  } catch (error) {
    showToast(`无法打开文件对话框：${messageOf(error)}`, 'error')
    return
  }
  if (!target) return
  try {
    const other = await readTextFile(target)
    const lines = diffLines(docState.content, other)
    const summary = summarize(lines)
    diffState.path = target
    diffState.chunks = compressDiff(lines)
    diffState.added = summary.added
    diffState.removed = summary.removed
    diffState.open = true
    if (!summary.changed) showToast('两份文件内容一致')
  } catch (error) {
    showToast(`对比失败：${messageOf(error)}`, 'error')
  }
}

export function closeDiff(): void {
  diffState.open = false
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
  if (!appState.recent.some((item) => item.path === path)) {
    addRecent(path, content)
    return
  }
  const name = parseResume(content).identity.name || baseName(path)
  appState.recent = updateRecentName(appState.recent, path, name)
  persistSettings()
}

function persistRecent(): void {
  persistSettings()
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
  const confirmed = await askConfirm(
    `检测到 ${refs.length} 张本地图片，是否复制到新目录？`,
    { title: '复制图片', confirmLabel: '复制' },
  )
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
  () => persistSettings(),
)

watch(
  () => appState.printTipsDismissed,
  () => persistSettings(),
)