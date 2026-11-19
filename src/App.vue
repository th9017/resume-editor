<script setup lang="ts">
import { computed, ref } from 'vue'
import { patchStyle } from './core/frontmatter'
import { parseResume } from './core/parser'
import { renderResume } from './core/render/renderer'
import { getTemplate } from './core/render/templates'
import { printHtml } from './core/print'
import type { DocStyle } from './core/types'
import { buildPrintSpikeHtml } from './samples/printSpike'
import { SHOWCASE_MARKDOWN } from './samples/showcase'
import PreviewPane from './components/PreviewPane.vue'
import StyleBar from './components/StyleBar.vue'

const source = ref(SHOWCASE_MARKDOWN)
const printing = ref(false)
const message = ref('')

const doc = computed(() => parseResume(source.value))
const template = computed(() => getTemplate(doc.value.style.template))
const html = computed(() => renderResume(doc.value, { template: template.value }))
const displayName = computed(() => doc.value.identity.name || '未命名简历')
const issueCount = computed(
  () => doc.value.diagnostics.filter((item) => item.severity !== 'info').length,
)

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
        <span class="tag">T3 · 模板预览</span>
      </div>
      <div class="actions">
        <button class="btn primary" :disabled="printing" @click="runPrintSpike">
          {{ printing ? '准备打印…' : '打印 A4 测试' }}
        </button>
      </div>
    </header>

    <StyleBar :doc-style="doc.style" @change="applyStyle" />

    <main class="workspace">
      <section class="pane editor-pane">
        <div class="pane-head">
          <span>Markdown 源码</span>
          <span class="muted">T4 接入 CodeMirror</span>
        </div>
        <textarea v-model="source" class="source" spellcheck="false" aria-label="Markdown 源码"></textarea>
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
      <span>A4 210×297mm</span>
      <span class="spacer"></span>
      <span v-if="issueCount" class="status-warn">{{ issueCount }} 条语法提示</span>
      <span>{{ message || '样式设置会写入 frontmatter' }}</span>
    </footer>
  </div>
</template>