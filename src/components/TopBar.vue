<script setup lang="ts">
import { ref } from 'vue'
import {
  Code2,
  Download,
  FilePlus2,
  FolderOpen,
  LayoutTemplate,
  MoreHorizontal,
  Save,
  SaveAll,
} from 'lucide-vue-next'
import type { RecentFile } from '../core/recent'

defineProps<{
  name: string
  path: string
  dirty: boolean
  printing: boolean
  recent: RecentFile[]
  autoSave: boolean
}>()

const emit = defineEmits<{
  (event: 'new'): void
  (event: 'open'): void
  (event: 'save'): void
  (event: 'saveAs'): void
  (event: 'export'): void
  (event: 'template'): void
  (event: 'recent', path: string): void
  (event: 'source'): void
  (event: 'toggleAutoSave'): void
}>()

const more = ref<HTMLDetailsElement>()

function closeMore(): void {
  if (more.value) more.value.open = false
}

function emitAndClose(event: 'new' | 'saveAs' | 'source'): void {
  if (event === 'new') emit('new')
  else if (event === 'saveAs') emit('saveAs')
  else emit('source')
  closeMore()
}

function openRecent(path: string): void {
  emit('recent', path)
  closeMore()
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="logo">简</div>
      <div class="brand-text">
        <span class="brand-name">简历编辑器</span>
        <span class="brand-sub">本地 · 无 AI</span>
      </div>
    </div>

    <div class="file-info" :title="path || '尚未保存'">
      <span class="file-name">{{ name }}</span>
      <span class="save-state" :class="{ dirty }">
        {{ dirty ? '未保存' : path ? '已保存' : '未修改' }}
      </span>
    </div>

    <div class="top-actions">
      <button class="tb-btn" @click="emit('open')">
        <FolderOpen :size="16" />
        <span>打开</span>
      </button>
      <button class="tb-btn" @click="emit('save')">
        <Save :size="16" />
        <span>保存</span>
      </button>
      <button class="tb-btn" @click="emit('template')">
        <LayoutTemplate :size="16" />
        <span>模板</span>
      </button>
      <button class="tb-btn primary" :disabled="printing" @click="emit('export')">
        <Download :size="16" />
        <span>{{ printing ? '准备中…' : '导出 PDF' }}</span>
      </button>

      <details ref="more" class="more">
        <summary class="tb-btn icon-only" aria-label="更多">
          <MoreHorizontal :size="18" />
        </summary>
        <div class="more-menu">
          <button @click="emitAndClose('new')">
            <FilePlus2 :size="15" />
            <span>新建</span>
          </button>
          <button @click="emitAndClose('saveAs')">
            <SaveAll :size="15" />
            <span>另存为</span>
          </button>
          <button @click="emitAndClose('source')">
            <Code2 :size="15" />
            <span>源码模式</span>
          </button>
          <label class="auto-save">
            <input type="checkbox" :checked="autoSave" @change="emit('toggleAutoSave')" />
            <span>自动保存</span>
          </label>
          <div class="menu-sep"></div>
          <div class="recent-title">最近文件</div>
          <button
            v-for="item in recent"
            :key="item.path"
            class="recent-item"
            @click="openRecent(item.path)"
          >
            <span class="recent-name">{{ item.name }}</span>
            <span class="recent-path">{{ item.path }}</span>
          </button>
          <div v-if="recent.length === 0" class="recent-empty">暂无最近文件</div>
        </div>
      </details>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 18px;
  height: 58px;
  padding: 0 18px;
  border-bottom: 1px solid var(--border);
  background: #ffffff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.logo {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c6bff, #5b4de0);
  color: #ffffff;
  font-size: 17px;
  font-weight: 700;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.brand-sub {
  font-size: 10px;
  color: var(--muted);
}

.file-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  margin-left: 4px;
  line-height: 1.35;
}

.file-name {
  max-width: 320px;
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-state {
  color: var(--muted);
  font-size: 10px;
}

.save-state.dirty {
  color: #b45309;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.tb-btn {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: #ffffff;
  color: #3f4455;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.tb-btn:hover {
  border-color: #c8cddb;
  background: #fafbff;
}

.tb-btn.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.tb-btn.primary:hover {
  background: #5d4ee6;
}

.tb-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.tb-btn.icon-only {
  width: 34px;
  justify-content: center;
  padding: 0;
}

.more {
  position: relative;
}

.more summary {
  list-style: none;
}

.more summary::-webkit-details-marker {
  display: none;
}

.more-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 1100;
  display: flex;
  width: 250px;
  flex-direction: column;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(23, 26, 45, 0.18);
}

.more-menu > button,
.more-menu .auto-save {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #3f4455;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.more-menu > button:hover,
.more-menu .auto-save:hover {
  background: #f5f6fb;
}

.auto-save input {
  accent-color: var(--accent);
}

.menu-sep {
  height: 1px;
  margin: 5px 4px;
  background: var(--border);
}

.recent-title {
  padding: 4px 10px;
  color: var(--muted);
  font-size: 10px;
}

.recent-item {
  display: block !important;
}

.recent-name {
  display: block;
  color: var(--text);
  font-size: 12px;
}

.recent-path {
  display: block;
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-empty {
  padding: 6px 10px 8px;
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 1100px) {
  .brand-sub,
  .top-actions .tb-btn span {
    display: none;
  }

  .tb-btn {
    width: 34px;
    justify-content: center;
    padding: 0;
  }

  .file-name {
    max-width: 180px;
  }
}
</style>