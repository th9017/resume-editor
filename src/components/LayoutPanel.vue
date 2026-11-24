<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-vue-next'
import { insertPosition, moveTarget } from '../core/dragSort'
import type { DraftSection } from '../core/draft'
import { SECTION_META } from '../core/types'
import { askConfirm } from '../stores/document'
import {
  draft,
  editorState,
  moveSection,
  removeSection,
  reorderSections,
  structuralEdit,
} from '../stores/editor'
import { sectionIcon } from './sectionIcons'

const dragging = ref(-1)
const dropAt = ref(-1)

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

async function remove(section: DraftSection): Promise<void> {
  const ok = await askConfirm(`删除「${labelFor(section)}」章节及其全部内容？`, {
    title: '删除章节',
    confirmLabel: '删除',
    danger: true,
  })
  if (ok) removeSection(section.id)
}

function openAddMenu(): void {
  editorState.addMenuOpen = true
}

function onDragStart(index: number, event: DragEvent): void {
  dragging.value = index
  dropAt.value = index
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
  const row = event.currentTarget instanceof HTMLElement ? event.currentTarget.parentElement : null
  if (row) event.dataTransfer.setDragImage(row, 20, 16)
}

function onDragOver(index: number, event: DragEvent): void {
  if (dragging.value < 0) return
  event.preventDefault()
  const row = event.currentTarget as HTMLElement
  const rect = row.getBoundingClientRect()
  dropAt.value = insertPosition(event.clientY, rect.top, rect.height, index)
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const to = moveTarget(dragging.value, dropAt.value, (draft.value?.sections.length ?? 0))
  if (to !== null) reorderSections(dragging.value, to)
  resetDrag()
}

function resetDrag(): void {
  dragging.value = -1
  dropAt.value = -1
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
        :class="{
          dragging: dragging === index,
          'drop-top': dragging >= 0 && dropAt === index && dropAt !== dragging,
          'drop-bottom': dragging >= 0 && dropAt === draft.sections.length && index === draft.sections.length - 1,
        }"
        @dragover="onDragOver(index, $event)"
        @drop="onDrop"
      >
        <span
          class="grip"
          draggable="true"
          title="拖动排序"
          @dragstart="onDragStart(index, $event)"
          @dragend="resetDrag"
        >
          <GripVertical :size="14" />
        </span>
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
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
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
  background: var(--panel);
}

.section-row.dragging {
  opacity: 0.45;
}

.section-row.drop-top {
  box-shadow: 0 -3px 0 -1px var(--accent);
}

.section-row.drop-bottom {
  box-shadow: 0 3px 0 -1px var(--accent);
}

.grip {
  display: flex;
  flex: none;
  align-items: center;
  color: var(--muted);
  cursor: grab;
}

.grip:hover {
  color: var(--accent);
}

.grip:active {
  cursor: grabbing;
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
  background: var(--panel-soft);
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
  background: var(--panel-tint);
  color: var(--text);
}

.row-actions button:disabled {
  opacity: 0.28;
  cursor: default;
}

.row-actions button.danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.empty {
  padding: 22px;
  border: 1px dashed var(--border-dashed);
  border-radius: 10px;
  background: var(--panel);
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
  border: 1px dashed var(--border-dashed);
  border-radius: 9px;
  background: var(--panel-soft);
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
}

.add-module:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>