<script setup lang="ts">
import { X } from 'lucide-vue-next'
import {
  cancelSourceSwitch,
  confirmSourceSwitch,
  editorState,
} from '../stores/editor'
</script>

<template>
  <div v-if="editorState.sourceWarningOpen" class="backdrop" @click.self="cancelSourceSwitch">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="source-warning-title">
      <header class="head">
        <div>
          <h2 id="source-warning-title">源码包含表单不支持的内容</h2>
          <p>切换到表单后，这些内容不会出现在表单中，保存时可能丢失。</p>
        </div>
        <button class="close" aria-label="关闭" @click="cancelSourceSwitch">
          <X :size="18" />
        </button>
      </header>
      <pre class="diagnostics">{{ editorState.sourceWarningMessage }}</pre>
      <div class="actions">
        <button class="btn" @click="cancelSourceSwitch">留在源码</button>
        <button class="btn danger" @click="confirmSourceSwitch">仍然切换</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1220;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 23, 40, 0.3);
}

.modal {
  width: min(520px, calc(100vw - 40px));
  padding: 20px;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 24px 64px rgba(20, 23, 40, 0.24);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.head h2 {
  margin: 0;
  color: var(--text);
  font-size: 16px;
}

.head p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.close {
  display: flex;
  width: 30px;
  height: 30px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: #f5f6fa;
  color: var(--muted);
  cursor: pointer;
}

.diagnostics {
  max-height: 220px;
  margin: 14px 0 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.actions .danger {
  border-color: #fca5a5;
  background: #fef2f2;
  color: #b91c1c;
}
</style>