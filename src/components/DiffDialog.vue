<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import { baseName } from '../core/paths'
import { diffState, closeDiff } from '../stores/document'

const fileName = computed(() => (diffState.path ? baseName(diffState.path) : ''))
const identical = computed(() => diffState.added === 0 && diffState.removed === 0)
</script>

<template>
  <div v-if="diffState.open" class="modal-backdrop" @click.self="closeDiff">
    <div class="diff-modal" role="dialog" aria-modal="true" aria-labelledby="diff-title">
      <header class="diff-head">
        <div>
          <h3 id="diff-title">与文件对比</h3>
          <p class="diff-file" :title="diffState.path">对比 {{ fileName || '未知文件' }}</p>
        </div>
        <button class="close" aria-label="关闭" @click="closeDiff">
          <X :size="18" />
        </button>
      </header>

      <div class="diff-legend">
        <span class="count del">− 仅当前文档 {{ diffState.removed }}</span>
        <span class="count add">+ 仅所选文件 {{ diffState.added }}</span>
        <span class="hint">当前文档作为基准；相同行只保留上下文</span>
      </div>

      <div class="diff-body">
        <p v-if="identical" class="identical">两份文件内容一致。</p>
        <template v-else>
          <div
            v-for="(chunk, index) in diffState.chunks"
            :key="index"
            class="diff-line"
            :class="chunk.kind"
          >
            <span v-if="chunk.kind === 'skip'" class="skip-text">… 省略 {{ chunk.count }} 行相同内容 …</span>
            <template v-else>
              <span class="mark">{{ chunk.kind === 'add' ? '+' : chunk.kind === 'del' ? '-' : ' ' }}</span>
              <span class="text">{{ chunk.text || ' ' }}</span>
            </template>
          </div>
        </template>
      </div>

      <footer class="diff-foot">
        <button class="btn" @click="closeDiff">关闭</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1250;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay);
}

.diff-modal {
  display: flex;
  width: min(760px, calc(100vw - 40px));
  max-height: calc(100vh - 80px);
  flex-direction: column;
  padding: 18px 20px;
  border-radius: 14px;
  background: var(--panel);
  box-shadow: 0 24px 64px var(--shadow-color);
}

.diff-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.diff-head h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
}

.diff-file {
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
}

.close:hover {
  background: var(--panel-tint);
}

.diff-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
}

.count.del {
  color: var(--danger);
}

.count.add {
  color: var(--accent);
}

.hint {
  margin-left: auto;
  color: var(--muted);
}

.diff-body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 6px 0;
}

.identical {
  margin: 12px 0;
  color: var(--text-soft);
  font-size: 12px;
}

.diff-line {
  display: flex;
  gap: 8px;
  padding: 1px 8px;
  border-radius: 4px;
  color: var(--text-soft);
  font-family: Consolas, "Courier New", monospace;
  font-size: 11.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-line.add {
  background: var(--accent-soft);
  color: var(--text);
}

.diff-line.del {
  background: var(--danger-soft);
  color: var(--text);
}

.diff-line.skip {
  justify-content: center;
  padding: 4px 0;
  color: var(--muted);
}

.mark {
  flex: none;
  width: 10px;
  color: var(--muted);
}

.diff-foot {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
</style>
