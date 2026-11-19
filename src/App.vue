<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ensureIdentity, patchStyle } from './core/frontmatter'
import { parseResume } from './core/parser'
import { renderResume } from './core/render/renderer'
import { getTemplate } from './core/render/templates'
import { itemSnippet, sectionSnippet, sectionWithItemSnippet } from './core/snippets'
import { SECTION_META, SECTION_OPTIONS } from './core/types'
import type { DocStyle } from './core/types'
import { printHtml } from './core/print'
import { buildPrintSpikeHtml } from './samples/printSpike'
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
import RecentMenu from './components/RecentMenu.vue'
import StyleBar from './components/StyleBar.vue'
import Toast from './components/Toast.vue'
import type { CursorPosition, ResumeEditorHandle } from './components/editorTypes'

const printing = ref(false)
const editorRef = ref<ResumeEditorHandle>()
const cursorLine = ref(1)
const sectionType = ref('experience')

const doc = computed(() => parseResume(docState.content))
const template = computed(() => getTemplate(doc.value.style.template))
const html = computed(() => renderResume(doc.value, { template: template.value }))
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

async function runPrintSpike(): Promise<void> {
  printing.value = true
  try {
    await printHtml(buildPrintSpikeHtml())
    showToast('已调起打印预览，请按提示检查 A4 版式')
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'error')
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
})
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <div class="brand">
        简历编辑器
        <span class="tag">T5 · 文件与保存</span>
      </div>
      <div class="actions">
        <button class="btn" @click="handleNew">新建</button>
        <button class="btn" @click="handleOpen()">打开</button>
        <button class="btn" @click="handleSave">保存</button>
        <button class="btn" @click="handleSaveAs">另存为</button>
        <RecentMenu :items="appState.recent" @open="handleOpen" />
        <button class="btn primary" :disabled="printing" @click="runPrintSpike">
          {{ printing ? '准备打印…' : '打印 A4 测试' }}
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
        />
        <DiagnosticsBar :diagnostics="doc.diagnostics" @jump="jumpTo" />
      </section>

      <section class="pane preview-pane">
        <div class="pane-head">
          <span>A4 预览</span>
          <span class="muted">{{ template.name }}</span>
        </div>
        <PreviewPane :html="html" :css="template.css" />
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
      <span>L{{ cursorLine }}</span>
      <span class="spacer"></span>
      <span v-if="issueCount" class="status-warn">{{ issueCount }} 条语法提示</span>
      <label class="status-toggle">
        <input v-model="appState.autoSave" type="checkbox" />
        <span>自动保存</span>
      </label>
    </footer>

    <ConfirmDialog />
    <Toast />
  </div>
</template>