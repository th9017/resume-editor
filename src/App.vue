<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ensureIdentity, patchAvatar, patchStyle } from './core/frontmatter'
import {
  assetFileName,
  buildImageMap,
  collectImageRefs,
  fileToDataUrl,
  resolveImagePath,
} from './core/images'
import { joinPath, parentDir, sanitizeFileName } from './core/paths'
import { parseResume } from './core/parser'
import { computeLayoutPlan, type LayoutPlan } from './core/measure'
import { renderResume } from './core/render/renderer'
import { getTemplate } from './core/render/templates'
import { itemSnippet, sectionSnippet, sectionWithItemSnippet } from './core/snippets'
import { SECTION_META, SECTION_OPTIONS } from './core/types'
import type { DocStyle } from './core/types'
import { buildResumePrintHtml, printHtml } from './core/print'
import { assetUrl, ensureDir, pickImageFile, readBinaryFile, writeBinaryFile } from './tauri'
import {
  appState,
  bindCloseHandler,
  dirty,
  docState,
  documentName,
  newDocument,
  openDocument,
  refreshWindowTitle,
  saveDocument,
  saveDocumentAs,
  showToast,
} from './stores/document'
import CodeMirrorEditor from './components/CodeMirrorEditor.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import DiagnosticsBar from './components/DiagnosticsBar.vue'
import PreviewPane from './components/PreviewPane.vue'
import PrintTipsDialog from './components/PrintTipsDialog.vue'
import RecentMenu from './components/RecentMenu.vue'
import StyleBar from './components/StyleBar.vue'
import Toast from './components/Toast.vue'
import type { CursorPosition, ResumeEditorHandle } from './components/editorTypes'

const printing = ref(false)
const printTipsOpen = ref(false)
const editorRef = ref<ResumeEditorHandle>()
const cursorLine = ref(1)
const sectionType = ref('experience')
const PRINT_TIPS_KEY = 'resume.printTipsDismissed.v1'
const layout = ref<LayoutPlan>({ fit: 1, stacked: false, pageCount: 1 })
const imageVersion = ref(0)
let layoutJob = 0
let layoutTimer: ReturnType<typeof setTimeout> | null = null
let templateStyleEl: HTMLStyleElement | null = null

const doc = computed(() => parseResume(docState.content))
const template = computed(() => getTemplate(doc.value.style.template))
const imageCache = reactive(new Map<string, string>())
let imageJob = 0
const html = computed(() =>
  renderResume(doc.value, {
    template: template.value,
    fit: layout.value.fit,
    stacked: layout.value.stacked,
    resolveImage: resolvePreviewImage,
  }),
)
const displayName = computed(() => documentName.value)
const issueCount = computed(
  () => doc.value.diagnostics.filter((item) => item.severity !== 'info').length,
)
const saveLabel = computed(() => {
  if (dirty.value) return '未保存'
  if (docState.lastSavedAt) return `已保存 ${docState.lastSavedAt}`
  return '未修改'
})
const currentSection = computed(() => {
  const line = cursorLine.value
  return doc.value.sections.find((section) => line >= section.line && line <= section.endLine) ?? null
})
const currentSectionLabel = computed(() => {
  const section = currentSection.value
  if (!section) return '不在章节内'
  return SECTION_META[section.type]?.label ?? section.title
})
const layoutWarning = computed(() => {
  const current = layout.value
  if (current.fit < 0.999 && current.pageCount > 1) {
    return `已压缩到 ${Math.round(current.fit * 100)}%，仍约 ${current.pageCount} 页，建议精简内容`
  }
  if (current.stacked) return '内容超过一页，双栏已降级为单栏（打印更稳定）'
  return ''
})
const pageLabel = computed(() => {
  const current = layout.value
  const pages = `约 ${current.pageCount} 页`
  return current.fit < 0.999 ? `${pages} · 缩放 ${Math.round(current.fit * 100)}%` : pages
})

function resolvePreviewImage(src: string): string {
  if (/^(https?:|data:|blob:|asset:)/i.test(src)) return src
  const absolute = resolveImagePath(docState.path, src)
  if (!absolute) return ''
  const cached = imageCache.get(absolute)
  if (cached !== undefined) return cached
  return assetUrl(absolute)
}

watch(
  [() => docState.path, () => docState.content],
  async () => {
    const job = ++imageJob
    for (const ref of collectImageRefs(doc.value)) {
      const absolute = resolveImagePath(docState.path, ref)
      if (!absolute || imageCache.has(absolute)) continue
      try {
        const dataUrl = await fileToDataUrl(absolute, readBinaryFile)
        if (job === imageJob) {
          imageCache.set(absolute, dataUrl)
          imageVersion.value++
        }
      } catch {
        if (job === imageJob) {
          imageCache.set(absolute, '')
          imageVersion.value++
        }
      }
    }
  },
  { immediate: true },
)

watch(
  () => template.value.css,
  (css) => {
    if (!templateStyleEl) {
      templateStyleEl = document.createElement('style')
      templateStyleEl.dataset.rvTemplate = 'true'
      document.head.appendChild(templateStyleEl)
    }
    templateStyleEl.textContent = css
  },
  { immediate: true },
)

async function recomputeLayout(): Promise<void> {
  const job = ++layoutJob
  const context = {
    doc: doc.value,
    template: template.value,
    resolveImage: resolvePreviewImage,
  }
  try {
    const plan = await computeLayoutPlan(context)
    if (job === layoutJob) layout.value = plan
  } catch {
    if (job === layoutJob) layout.value = { fit: 1, stacked: false, pageCount: 1 }
  }
}

function scheduleLayout(): void {
  if (layoutTimer) clearTimeout(layoutTimer)
  layoutTimer = setTimeout(() => {
    layoutTimer = null
    void recomputeLayout()
  }, 200)
}

watch([() => docState.content, imageVersion], scheduleLayout, { immediate: true })

function onUpdate(value: string): void {
  docState.content = value
}

function onCursor(position: CursorPosition): void {
  cursorLine.value = position.line
}

function applyStyle(patch: Partial<DocStyle>): void {
  try {
    docState.content = patchStyle(docState.content, patch)
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'error')
  }
}

function insertSection(): void {
  const type = sectionType.value
  const snippet = sectionSnippet(type)
  editorRef.value?.appendToEnd(snippet.text, snippet.cursorOffset)
  showToast(`已追加「${SECTION_META[type]?.label ?? type}」章节`)
}

function insertItem(): void {
  const section = currentSection.value
  const type = section?.type ?? sectionType.value
  const meta = SECTION_META[type]
  if (meta && !meta.itemized) {
    showToast('该章节使用 Markdown 正文，不使用条目')
    return
  }
  const snippet = itemSnippet(type)
  if (section) {
    const closingLine = section.endLine
    const lineText = docState.content.split('\n')[closingLine - 1] ?? ''
    if (/^\s*:{4,}\s*$/.test(lineText)) {
      editorRef.value?.insertBeforeLine(closingLine, snippet.text, snippet.cursorOffset)
    } else {
      editorRef.value?.appendToEnd(snippet.text, snippet.cursorOffset)
    }
    showToast(`已在「${meta?.label ?? section.title}」插入条目`)
    return
  }
  const combined = sectionWithItemSnippet(type)
  editorRef.value?.appendToEnd(combined.text, combined.cursorOffset)
  showToast(`已追加「${meta?.label ?? type}」章节并插入条目`)
}

async function insertIdentity(): Promise<void> {
  try {
    const result = ensureIdentity(docState.content)
    docState.content = result.source
    await nextTick()
    editorRef.value?.gotoLine(result.line, result.column)
    showToast('已定位到个人信息字段')
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'error')
  }
}

async function handlePasteImages(files: File[]): Promise<void> {
  if (!docState.path) {
    showToast('请先保存文档，再插入图片', 'error')
    return
  }
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  const assetsDir = joinPath(parentDir(docState.path), 'assets')
  const refs: string[] = []
  try {
    await ensureDir(assetsDir)
    for (const file of files) {
      if (!allowed.has(file.type)) {
        showToast(`不支持的图片格式：${file.type || '未知'}`, 'error')
        continue
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (bytes.length > 5 * 1024 * 1024 && !window.confirm('图片大于 5MB，仍要插入吗？')) {
        continue
      }
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
      const name = assetFileName('img', ext)
      await writeBinaryFile(joinPath(assetsDir, name), bytes)
      refs.push(`assets/${name}`)
    }
  } catch (error) {
    showToast(`图片保存失败：${messageOf(error)}`, 'error')
    return
  }
  if (refs.length === 0) return
  const markdown = refs
    .map((ref, index) => `![图片${refs.length > 1 ? index + 1 : ''}](${ref})`)
    .join('\n')
  editorRef.value?.insertAtCursor(markdown)
  showToast(`已插入 ${refs.length} 张图片`)
}

async function setAvatar(): Promise<void> {
  if (!docState.path) {
    showToast('请先保存文档，再设置头像', 'error')
    return
  }
  let selected: string | null = null
  try {
    selected = await pickImageFile()
  } catch (error) {
    showToast(`无法打开图片对话框：${messageOf(error)}`, 'error')
    return
  }
  if (!selected) return
  const rawExt = selected.split('.').pop()?.toLowerCase() ?? ''
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt
  if (!['png', 'jpg', 'webp', 'gif'].includes(ext)) {
    showToast('仅支持 PNG/JPG/WebP/GIF 图片', 'error')
    return
  }
  try {
    const bytes = await readBinaryFile(selected)
    if (bytes.length > 5 * 1024 * 1024 && !window.confirm('图片大于 5MB，仍要使用吗？')) return
    const assetsDir = joinPath(parentDir(docState.path), 'assets')
    await ensureDir(assetsDir)
    const name = assetFileName('avatar', ext)
    await writeBinaryFile(joinPath(assetsDir, name), bytes)
    docState.content = patchAvatar(docState.content, `assets/${name}`)
    showToast('头像已更新')
  } catch (error) {
    showToast(`头像设置失败：${messageOf(error)}`, 'error')
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function handleNew(): Promise<void> {
  if (await newDocument()) {
    await nextTick()
    editorRef.value?.gotoLine(1)
  }
}

async function handleOpen(path?: string): Promise<void> {
  if (await openDocument(path)) {
    await nextTick()
    editorRef.value?.gotoLine(1)
  }
}

function handleSave(): void {
  void saveDocument()
}

function handleSaveAs(): void {
  void saveDocumentAs()
}

function jumpTo(line: number): void {
  editorRef.value?.gotoLine(line)
}

function onKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    if (event.shiftKey) void saveDocumentAs()
    else void saveDocument()
  } else if (key === 'o') {
    event.preventDefault()
    void handleOpen()
  } else if (key === 'n') {
    event.preventDefault()
    void handleNew()
  }
}

function printTipsDismissed(): boolean {
  try {
    return localStorage.getItem(PRINT_TIPS_KEY) === '1'
  } catch {
    return false
  }
}

function rememberPrintTips(): void {
  try {
    localStorage.setItem(PRINT_TIPS_KEY, '1')
  } catch {
    /* 偏好保存失败时忽略 */
  }
}

function handleExport(): void {
  if (printTipsDismissed()) {
    void runPrint()
    return
  }
  printTipsOpen.value = true
}

function onPrintTipsConfirm(dontShow: boolean): void {
  if (dontShow) rememberPrintTips()
  printTipsOpen.value = false
  void runPrint()
}

async function runPrint(): Promise<void> {
  printing.value = true
  try {
    const parsed = doc.value
    const imageUrls = await buildImageMap(parsed, docState.path, readBinaryFile)
    const printResolver = (src: string): string => {
      if (/^(https?:|data:|blob:|asset:)/i.test(src)) return src
      return imageUrls.get(src) ?? ''
    }
    const plan = await computeLayoutPlan({
      doc: parsed,
      template: template.value,
      resolveImage: printResolver,
    })
    const name = parsed.identity.name.trim()
    const title = name ? `${sanitizeFileName(name)}-简历` : '我的简历'
    const printDocument = buildResumePrintHtml({
      doc: parsed,
      template: template.value,
      title,
      imageUrls,
      fit: plan.fit,
      stacked: plan.stacked,
    })
    await printHtml(printDocument)
    showToast(`已调起打印预览（约 ${plan.pageCount} 页），请另存为 PDF`)
  } catch (error) {
    showToast(`导出失败：${messageOf(error)}`, 'error')
  } finally {
    printing.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void bindCloseHandler()
  void refreshWindowTitle()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (layoutTimer) {
    clearTimeout(layoutTimer)
    layoutTimer = null
  }
  layoutJob++
  templateStyleEl?.remove()
  templateStyleEl = null
})
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <div class="brand">
        简历编辑器
        <span class="tag">T7 · PDF 导出</span>
      </div>
      <div class="actions">
        <button class="btn" @click="handleNew">新建</button>
        <button class="btn" @click="handleOpen()">打开</button>
        <button class="btn" @click="handleSave">保存</button>
        <button class="btn" @click="handleSaveAs">另存为</button>
        <RecentMenu :items="appState.recent" @open="handleOpen" />
        <button class="btn primary" :disabled="printing" @click="handleExport">
          {{ printing ? '准备打印…' : '导出 PDF' }}
        </button>
      </div>
    </header>

    <StyleBar :doc-style="doc.style" @change="applyStyle" />

    <div class="insertbar">
      <span class="label">插入</span>
      <select v-model="sectionType" class="mini-select" aria-label="选择章节类型">
        <option v-for="option in SECTION_OPTIONS" :key="option.type" :value="option.type">
          {{ option.label }}
        </option>
      </select>
      <button class="mini-btn" @click="insertSection">章节</button>
      <button class="mini-btn" @click="insertItem">条目</button>
      <button class="mini-btn" @click="insertIdentity">个人信息</button>
      <button class="mini-btn" @click="setAvatar">头像</button>
      <span class="insert-hint">当前章节：{{ currentSectionLabel }}</span>
    </div>

    <main class="workspace">
      <section class="pane editor-pane">
        <div class="pane-head">
          <span>Markdown 源码</span>
          <span class="muted">CodeMirror 6</span>
        </div>
        <CodeMirrorEditor
          ref="editorRef"
          :value="docState.content"
          @update="onUpdate"
          @cursor="onCursor"
          @paste-images="handlePasteImages"
        />
        <DiagnosticsBar :diagnostics="doc.diagnostics" @jump="jumpTo" />
      </section>

      <section class="pane preview-pane">
        <div class="pane-head">
          <span>A4 预览</span>
          <span class="muted">
            {{ template.name }}<template v-if="layout.stacked"> · 已降级单栏</template>
          </span>
        </div>
        <div v-if="layoutWarning" class="layout-note">{{ layoutWarning }}</div>
        <PreviewPane :html="html" :page-count="layout.pageCount" />
      </section>
    </main>

    <footer class="statusbar">
      <span>{{ displayName }}</span>
      <span class="dot">·</span>
      <span class="status-path" :title="docState.path">{{ docState.path || '尚未选择文件' }}</span>
      <span class="dot">·</span>
      <span :class="{ 'status-warn': saveLabel === '未保存' }">{{ saveLabel }}</span>
      <span class="dot">·</span>
      <span>{{ template.name }}</span>
      <span class="dot">·</span>
      <span>{{ pageLabel }}</span>
      <span class="dot">·</span>
      <span>L{{ cursorLine }}</span>
      <span class="spacer"></span>
      <span v-if="issueCount" class="status-warn">{{ issueCount }} 条语法提示</span>
      <label class="status-toggle">
        <input v-model="appState.autoSave" type="checkbox" />
        <span>自动保存</span>
      </label>
    </footer>

    <ConfirmDialog />
    <PrintTipsDialog
      :open="printTipsOpen"
      @confirm="onPrintTipsConfirm"
      @cancel="printTipsOpen = false"
    />
    <Toast />
  </div>
</template>