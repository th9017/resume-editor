<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, Code2 } from 'lucide-vue-next'
import { assetFileName } from '../core/images'
import { joinPath, parentDir } from '../core/paths'
import {
  ensureDir,
  writeBinaryFile,
} from '../tauri'
import { askConfirm, docState, showToast } from '../stores/document'
import { requestSourceSwitch, sourceDiagnostics } from '../stores/editor'
import CodeMirrorEditor from './CodeMirrorEditor.vue'
import DiagnosticsBar from './DiagnosticsBar.vue'
import type { ResumeEditorHandle } from './editorTypes'

const editorRef = ref<ResumeEditorHandle>()

function onUpdate(value: string): void {
  docState.content = value
}

function jumpTo(line: number): void {
  editorRef.value?.gotoLine(line)
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
      if (
        bytes.length > 5 * 1024 * 1024 &&
        !(await askConfirm('图片大于 5MB，仍要插入吗？', { title: '图片过大', confirmLabel: '仍然插入' }))
      ) {
        continue
      }
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
      const name = assetFileName('img', ext)
      await writeBinaryFile(joinPath(assetsDir, name), bytes)
      refs.push(`assets/${name}`)
    }
  } catch (error) {
    showToast(`图片保存失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    return
  }
  if (refs.length === 0) return
  const markdown = refs
    .map((ref, index) => `![图片${refs.length > 1 ? index + 1 : ''}](${ref})`)
    .join('\n')
  editorRef.value?.insertAtCursor(markdown)
  showToast(`已插入 ${refs.length} 张图片`)
}
</script>

<template>
  <section class="source-panel">
    <header class="source-head">
      <div class="source-title">
        <Code2 :size="17" />
        <div>
          <h1>源码模式</h1>
          <p>直接编辑 Markdown；返回表单时会解析并提示不支持的内容。</p>
        </div>
      </div>
      <button class="back-btn" @click="requestSourceSwitch">
        <ArrowLeft :size="15" />
        返回表单
      </button>
    </header>
    <div class="source-body">
      <CodeMirrorEditor
        ref="editorRef"
        :value="docState.content"
        @update="onUpdate"
        @paste-images="handlePasteImages"
      />
      <DiagnosticsBar :diagnostics="sourceDiagnostics" @jump="jumpTo" />
    </div>
  </section>
</template>

<style scoped>
.source-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  grid-column: span 2;
  background: var(--app-bg);
}

.source-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: #ffffff;
}

.source-title {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--accent);
}

.source-title h1 {
  margin: 0;
  color: var(--text);
  font-size: 15px;
}

.source-title p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.back-btn {
  display: inline-flex;
  height: 32px;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.back-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.source-body {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  background: #fbfcfe;
}
</style>