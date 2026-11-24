<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  buildImageMap,
  collectImageRefs,
  fileToDataUrl,
  resolveImagePath,
} from './core/images'
import { baseName, joinPath, parentDir, sanitizeFileName } from './core/paths'
import { computeLayoutPlan, type LayoutPlan } from './core/measure'
import { renderResume } from './core/render/renderer'
import { getTemplate } from './core/render/templates'
import { buildResumePrintHtml, printHtml } from './core/print'
import { assetUrl, exportPdf, pickPdfPath, readBinaryFile } from './tauri'
import {
  appState,
  bindCloseHandler,
  dirty,
  docState,
  initSettings,
  newDocument,
  openDocument,
  refreshWindowTitle,
  saveDocument,
  saveDocumentAs,
  setBeforeCloseHook,
  setPrintTipsDismissed,
  setTheme,
  showToast,
  toggleDirectPdf,
} from './stores/document'
import {
  canRedo,
  canUndo,
  currentDoc,
  draft,
  draftRevision,
  editorState,
  enterSourceMode,
  flushDraft,
  loadFromContent,
  redoFormEdit,
  requestSourceSwitch,
  undoFormEdit,
} from './stores/editor'
import TopBar from './components/TopBar.vue'
import SectionRail from './components/SectionRail.vue'
import FormPanel from './components/FormPanel.vue'
import TemplateDrawer from './components/TemplateDrawer.vue'
import AddSectionMenu from './components/AddSectionMenu.vue'
import SourcePanel from './components/SourcePanel.vue'
import SourceWarningDialog from './components/SourceWarningDialog.vue'
import PreviewPane from './components/PreviewPane.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import PrintTipsDialog from './components/PrintTipsDialog.vue'
import Toast from './components/Toast.vue'

const printing = ref(false)
const printTipsOpen = ref(false)
const drawerOpen = ref(false)
const layout = ref<LayoutPlan>({ fit: 1, stacked: false, pageCount: 1 })
const imageVersion = ref(0)
let layoutJob = 0
let layoutTimer: ReturnType<typeof setTimeout> | null = null
let templateStyleEl: HTMLStyleElement | null = null

const currentTemplate = computed(() => getTemplate(currentDoc.value.style.template))
const imageCache = reactive(new Map<string, string>())
let imageJob = 0

const html = computed(() =>
  renderResume(currentDoc.value, {
    template: currentTemplate.value,
    fit: layout.value.fit,
    stacked: layout.value.stacked,
    resolveImage: resolvePreviewImage,
  }),
)

const sections = computed(() => draft.value?.sections ?? [])
const isDirty = computed(() => dirty.value)
const displayName = computed(() => {
  const name = currentDoc.value.identity.name.trim()
  if (name) return name
  if (docState.path) return baseName(docState.path).replace(/\.(md|markdown)$/i, '')
  return '未命名简历'
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
  [() => docState.path, () => currentDoc.value],
  async () => {
    const job = ++imageJob
    for (const ref of collectImageRefs(currentDoc.value)) {
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
  () => currentTemplate.value.css,
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
    doc: currentDoc.value,
    template: currentTemplate.value,
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

watch([draftRevision, () => docState.content, imageVersion], scheduleLayout, { immediate: true })

function selectView(id: string): void {
  editorState.activeView = id
}

function toggleAutoSave(): void {
  appState.autoSave = !appState.autoSave
}

async function handleNew(): Promise<void> {
  flushDraft()
  if (await newDocument()) loadFromContent(docState.content)
}

async function handleOpen(path?: string): Promise<void> {
  flushDraft()
  if (await openDocument(path)) loadFromContent(docState.content)
}

function handleSave(): void {
  flushDraft()
  void saveDocument()
}

function handleSaveAs(): void {
  flushDraft()
  void saveDocumentAs()
}

function handleSourcePlaceholder(): void {
  if (editorState.mode === 'form') enterSourceMode()
  else requestSourceSwitch()
}

function openTemplate(): void {
  if (editorState.mode === 'source') {
    showToast('请先返回表单，再调整模板与主题')
    return
  }
  drawerOpen.value = true
}

function handleAddSectionPlaceholder(): void {
  editorState.addMenuOpen = true
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function handleUndo(): void {
  undoFormEdit()
}

function handleRedo(): void {
  redoFormEdit()
}

function onKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    if (event.shiftKey) {
      flushDraft()
      void saveDocumentAs()
    } else {
      flushDraft()
      void saveDocument()
    }
  } else if (key === 'o') {
    event.preventDefault()
    void handleOpen()
  } else if (key === 'n') {
    event.preventDefault()
    void handleNew()
  } else if (key === 'z' || key === 'y') {
    // 光标在输入框内时保留浏览器逐字符撤销，其它场景走全局撤销栈
    if (isEditableTarget(event.target)) return
    event.preventDefault()
    if (key === 'y' || event.shiftKey) handleRedo()
    else handleUndo()
  }
}

function handleExport(): void {
  if (appState.directPdf || appState.printTipsDismissed) {
    void runPrint()
    return
  }
  printTipsOpen.value = true
}

function onPrintTipsConfirm(dontShow: boolean): void {
  if (dontShow) setPrintTipsDismissed()
  printTipsOpen.value = false
  void runPrint()
}

/** 直接写 PDF；返回 fallback 时才需要打开系统打印窗口 */
async function tryExportPdf(html: string, name: string): Promise<'done' | 'cancelled' | 'fallback'> {
  const base = sanitizeFileName(name || '我的简历')
  const suggested = docState.path ? joinPath(parentDir(docState.path), `${base}.pdf`) : `${base}.pdf`
  const target = await pickPdfPath(suggested)
  if (!target) return 'cancelled'
  const pdfPath = /\.pdf$/i.test(target) ? target : `${target}.pdf`
  try {
    await exportPdf(html, pdfPath)
    showToast(`已导出 ${pdfPath}`)
    return 'done'
  } catch (error) {
    showToast(`无法直接导出：${messageOf(error)}，改用系统打印`, 'error')
    return 'fallback'
  }
}

async function runPrint(): Promise<void> {
  printing.value = true
  try {
    flushDraft()
    const parsed = currentDoc.value
    const imageUrls = await buildImageMap(parsed, docState.path, readBinaryFile)
    const printResolver = (src: string): string => {
      if (/^(https?:|data:|blob:|asset:)/i.test(src)) return src
      return imageUrls.get(src) ?? ''
    }
    const plan = await computeLayoutPlan({
      doc: parsed,
      template: currentTemplate.value,
      resolveImage: printResolver,
    })
    const name = parsed.identity.name.trim()
    const title = name ? `${sanitizeFileName(name)}-简历` : '我的简历'
    const printDocument = buildResumePrintHtml({
      doc: parsed,
      template: currentTemplate.value,
      title,
      imageUrls,
      fit: plan.fit,
      stacked: plan.stacked,
    })
    if (appState.directPdf && (await tryExportPdf(printDocument, name)) !== 'fallback') return
    await printHtml(printDocument)
    showToast(`已调起打印预览（约 ${plan.pageCount} 页），请另存为 PDF`)
  } catch (error) {
    showToast(`导出失败：${messageOf(error)}`, 'error')
  } finally {
    printing.value = false
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

onMounted(() => {
  loadFromContent(docState.content)
  setBeforeCloseHook(() => flushDraft())
  window.addEventListener('keydown', onKeydown)
  void initSettings()
  void bindCloseHandler()
  void refreshWindowTitle()
})

onBeforeUnmount(() => {
  setBeforeCloseHook(null)
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
  <div class="shell">
    <TopBar
      :name="displayName"
      :path="docState.path"
      :dirty="isDirty"
      :printing="printing"
      :recent="appState.recent"
      :auto-save="appState.autoSave"
      :direct-pdf="appState.directPdf"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :theme="appState.theme"
      @new="handleNew"
      @open="handleOpen()"
      @save="handleSave"
      @save-as="handleSaveAs"
      @export="handleExport"
      @template="openTemplate"
      @recent="handleOpen"
      @source="handleSourcePlaceholder"
      @toggle-auto-save="toggleAutoSave"
      @toggle-direct-pdf="toggleDirectPdf"
      @undo="handleUndo"
      @redo="handleRedo"
      @set-theme="setTheme"
    />

    <div class="workspace">
      <template v-if="editorState.mode === 'form'">
        <SectionRail
          :sections="sections"
          :active="editorState.activeView"
          @select="selectView"
          @add="handleAddSectionPlaceholder"
          @template="openTemplate"
        />
        <FormPanel />
      </template>
      <SourcePanel v-else />

      <section class="preview-pane">
        <header class="preview-head">
          <span>A4 预览</span>
          <span class="preview-meta">
            {{ currentTemplate.name }} · {{ pageLabel }}
          </span>
        </header>
        <div v-if="layoutWarning" class="layout-note">{{ layoutWarning }}</div>
        <PreviewPane :html="html" :page-count="layout.pageCount" />
      </section>
    </div>

    <TemplateDrawer :open="drawerOpen" @close="drawerOpen = false" />
    <AddSectionMenu />
    <SourceWarningDialog />
    <ConfirmDialog />
    <PrintTipsDialog
      :open="printTipsOpen"
      @confirm="onPrintTipsConfirm"
      @cancel="printTipsOpen = false"
    />
    <Toast />
  </div>
</template>