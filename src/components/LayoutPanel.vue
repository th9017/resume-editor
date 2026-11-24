<script setup lang="ts">
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-vue-next'
import type { DraftSection } from '../core/draft'
import { SECTION_META } from '../core/types'
import {
  draft,
  editorState,
  moveSection,
  removeSection,
  structuralEdit,
} from '../stores/editor'
import { sectionIcon } from './sectionIcons'

function labelFor(section: DraftSection): string {
  return section.title || SECTION_META[section.type]?.label || '自定义章节'
}

function typeFor(section: DraftSection): string {
  return SECTION_META[section.type]?.label ?? '自定义章节'
}

function select(section: DraftSection): void {
  editorState.activeView = section.id
}

function setPlacement(section: DraftSection, event: Event): void {
  section.placement = (event.target as HTMLSelectElement).value as DraftSection['placement']
  structuralEdit(`placement:${section.id}`)
}

function remove(section: DraftSection): void {
  if (!window.confirm(`删除「${labelFor(section)}」章节及其内容？`)) return
  removeSection(section.id)
}

function openAddMenu(): void {
  editorState.addMenuOpen = true
}
</script>

<template>
  <div class="layout-panel">
    <div class="layout-hint">
      调整章节顺序和双栏位置；点击章节标题可进入对应表单。
    </div>

    <div v-if="draft?.sections.length" class="section-list">
      <div
        v-for="(section, index) in draft.sections"
        :key="section.id"
        class="section-row"
      >
        <component :is="sectionIcon(section.type)" :size="16" class="section-icon" />
        <button class="section-title" :title="labelFor(section)" @click="select(section)">
          {{ labelFor(section) }}
        </button>
        <span class="section-type">{{ typeFor(section) }}</span>
        <select
          class="placement"
          :value="section.placement"
          title="双栏模板中的位置"
          @change="setPlacement(section, $event)"
        >
          <option value="auto">自动</option>
          <option value="main">主栏</option>
          <option value="side">侧栏</option>
        </select>
        <div class="row-actions">
          <button title="上移" :disabled="index === 0" @click="moveSection(section.id, -1)">
            <ArrowUp :size="13" />
          </button>
          <button
            title="下移"
            :disabled="index === draft.sections.length - 1"
            @click="moveSection(section.id, 1)"
          >
            <ArrowDown :size="13" />
          </button>
          <button class="danger" title="删除" @click="remove(section)">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </div>
    <div v-else class="empty">还没有章节，添加一个模块开始。</div>

    <button class="add-module" @click="openAddMenu">
      <Plus :size="15" />
      添加模块
    </button>
  </div>
</template>

<style scoped>
.layout-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layout-hint {
  padding: 10px 12px;
  border: 1px solid #e4e7f2;
  border-radius: 10px;
  background: #ffffff;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.section-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.section-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #ffffff;
}

.section-icon {
  flex: none;
  color: var(--accent);
}

.section-title {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.section-title:hover {
  color: var(--accent);
}

.section-type {
  flex: none;
  color: var(--muted);
  font-size: 10px;
}

.placement {
  height: 26px;
  padding: 0 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fbfbfe;
  color: var(--muted);
  font-size: 10px;
}

.row-actions {
  display: flex;
  flex: none;
  gap: 1px;
}

.row-actions button {
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.row-actions button:hover {
  background: #f4f5fa;
  color: var(--text);
}

.row-actions button:disabled {
  opacity: 0.28;
  cursor: default;
}

.row-actions button.danger:hover {
  background: #fef2f2;
  color: #b91c1c;
}

.empty {
  padding: 22px;
  border: 1px dashed #d8dcea;
  border-radius: 10px;
  background: #ffffff;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.add-module {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed #cfd4e2;
  border-radius: 9px;
  background: #fbfbff;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
}

.add-module:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>