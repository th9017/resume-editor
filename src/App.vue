<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ensureIdentity, patchStyle } from './core/frontmatter'
import { parseResume } from './core/parser'
import { renderResume } from './core/render/renderer'
import { getTemplate } from './core/render/templates'
import { itemSnippet, sectionSnippet, sectionWithItemSnippet } from './core/snippets'
import { SECTION_META, SECTION_OPTIONS } from './core/types'
import type { DocStyle } from './core/types'
import { printHtml } from './core/print'
import { buildPrintSpikeHtml } from './samples/printSpike'
import { SHOWCASE_MARKDOWN } from './samples/showcase'
import CodeMirrorEditor from './components/CodeMirrorEditor.vue'
import DiagnosticsBar from './components/DiagnosticsBar.vue'
import PreviewPane from './components/PreviewPane.vue'
import StyleBar from './components/StyleBar.vue'
import type { CursorPosition, ResumeEditorHandle } from './components/editorTypes'

const source = ref(SHOWCASE_MARKDOWN)
const printing = ref(false)
const message = ref('')
const editorRef = ref<ResumeEditorHandle>()
const cursorLine = ref(1)
const sectionType = ref('experience')

const doc = computed(() => parseResume(source.value))
const template = computed(() => getTemplate(doc.value.style.template))
const html = computed(() => renderResume(doc.value, { template: template.value }))
const displayName = computed(() => doc.value.identity.name || '未命名简历')
const issueCount = computed(
  () => doc.value.diagnostics.filter((item) => item.severity !== 'info').length,
)
const currentSection = computed(() => {
  const line = cursorLine.value
  return doc.value.sections.find((section) => line >= section.line && line <= section.endLine) ?? null
})
const currentSectionLabel = computed(() => {
  const section = currentSection.value
  if (!section) return '不在章节内'
  return SECTION_META[section.type]?.label ?? section.title
})

function flash(text: string): void {
  message.value = text
  setTimeout(() => {
    message.value = ''
  }, 6000)
}

function applyStyle(patch: Partial<DocStyle>): void {
  try {
    source.value = patchStyle(source.value, patch)
    message.value = ''
  } catch (error) {
    flash(error instanceof Error ? error.message : String(error))
  }
}

function onCursor(position: CursorPosition): void {
  cursorLine.value = position.line
}

function insertSection(): void {
  const type = sectionType.value
  const snippet = sectionSnippet(type)
  editorRef.value?.appendToEnd(snippet.text, snippet.cursorOffset)
  flash(`已追加「${SECTION_META[type]?.label ?? type}」章节`)
}

function insertItem(): void {
  const section = currentSection.value
  const type = section?.type ?? sectionType.value
  const meta = SECTION_META[type]
  if (meta && !meta.itemized) {
    flash('该章节使用 Markdown 正文，不使用条目')
    return
  }
  const snippet = itemSnippet(type)
  if (section) {
    const closingLine = section.endLine
    const lineText = source.value.split('\n')[closingLine - 1] ?? ''
    if (/^\s*:{4,}\s*$/.test(lineText)) {
      editorRef.value?.insertBeforeLine(closingLine, snippet.text, snippet.cursorOffset)
    } else {
      editorRef.value?.appendToEnd(snippet.text, snippet.cursorOffset)
    }
    flash(`已在「${meta?.label ?? section.title}」插入条目`)
    return
  }
  const combined = sectionWithItemSnippet(type)
  editorRef.value?.appendToEnd(combined.text, combined.cursorOffset)
  flash(`已追加「${meta?.label ?? type}」章节并插入条目`)
}

async function insertIdentity(): Promise<void> {
  try {
    const result = ensureIdentity(source.value)
    source.value = result.source
    await nextTick()
    editorRef.value?.gotoLine(result.line, result.column)
    flash('已定位到个人信息字段')
  } catch (error) {
    flash(error instanceof Error ? error.message : String(error))
  }
}

function jumpTo(line: number): void {
  editorRef.value?.gotoLine(line)
}

async function runPrintSpike(): Promise<void> {
  printing.value = true
  try {
    await printHtml(buildPrintSpikeHtml())
    flash('已调起打印预览，请按提示检查 A4 版式')
  } catch (error) {
    flash(error instanceof Error ? error.message : String(error))
  } finally {
    printing.value = false
  }
}
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <div class="brand">
        简历编辑器
        <span class="tag">T4 · 源码编辑</span>
      </div>
      <div class="actions">
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
          :value="source"
          @update="source = $event"
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
      <span>{{ template.name }}</span>
      <span class="dot">·</span>
      <span>L{{ cursorLine }}</span>
      <span class="dot">·</span>
      <span>A4 210×297mm</span>
      <span class="spacer"></span>
      <span v-if="issueCount" class="status-warn">{{ issueCount }} 条语法提示</span>
      <span>{{ message || '插入助手会生成合法的容器骨架' }}</span>
    </footer>
  </div>
</template>