<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
} from 'lucide-vue-next'
import {
  fieldKeysFor,
  type DraftItem,
  type DraftSection,
} from '../core/draft'
import { insertPosition, moveTarget } from '../core/dragSort'
import { FIELD_LABELS } from '../core/types'
import { askConfirm } from '../stores/document'
import { moveItem, removeItem, reorderItems, touchDraft } from '../stores/editor'
import BulletListEditor from './BulletListEditor.vue'

const DRAG_TYPE = 'application/x-resume-item'

const props = defineProps<{
  section: DraftSection
  item: DraftItem
  index: number
}>()

const open = ref(true)
const noteOpen = ref(Boolean(props.item.note))

const fieldKeys = computed(() => {
  const known = fieldKeysFor(props.section.type)
  const extras = Object.keys(props.item.fields).filter((key) => !known.includes(key))
  return [...known, ...extras]
})

const summary = computed(() => {
  const fields = props.item.fields
  return fields.company || fields.name || fields.school || fields.title || fields.role || '未命名条目'
})

const meta = computed(() => {
  const fields = props.item.fields
  return [fields.period, fields.location].filter(Boolean).join(' · ')
})

const placeholders: Record<string, string> = {
  company: '公司名称',
  role: '职位',
  period: '2022.06 — 至今',
  location: '城市',
  stack: '技术栈',
  link: 'https://...',
  name: '项目名称',
  school: '学校名称',
  degree: '本科',
  major: '专业',
  gpa: '3.8 / 4.0',
  title: '标题',
  subtitle: '副标题',
  issuer: '颁发方',
  date: '2024',
}

function setField(key: string, value: string): void {
  props.item.fields[key] = value
  touchDraft(`field:${props.item.id}:${key}`)
}

function setNote(value: string): void {
  props.item.note = value
  touchDraft(`note:${props.item.id}`)
}

function move(delta: -1 | 1): void {
  moveItem(props.section.id, props.item.id, delta)
}

async function remove(): Promise<void> {
  const ok = await askConfirm(`删除条目「${summary.value}」及其要点？`, {
    title: '删除条目',
    confirmLabel: '删除',
    danger: true,
  })
  if (ok) removeItem(props.section.id, props.item.id)
}

const dragging = ref(false)
const dropAt = ref(-1)

function positionOf(event: DragEvent): number {
  const card = event.currentTarget as HTMLElement
  const rect = card.getBoundingClientRect()
  return insertPosition(event.clientY, rect.top, rect.height, props.index)
}

function onDragStart(event: DragEvent): void {
  dragging.value = true
  const data = event.dataTransfer
  if (!data) return
  data.effectAllowed = 'move'
  data.setData(DRAG_TYPE, String(props.index))
  const card = event.currentTarget instanceof HTMLElement ? event.currentTarget.closest('.item-card') : null
  if (card) data.setDragImage(card, 24, 18)
}

function onDragOver(event: DragEvent): void {
  if (!event.dataTransfer?.types.includes(DRAG_TYPE)) return
  event.preventDefault()
  dropAt.value = positionOf(event)
}

function onDrop(event: DragEvent): void {
  const raw = event.dataTransfer?.getData(DRAG_TYPE)
  dropAt.value = -1
  if (raw === undefined || raw === '') return
  event.preventDefault()
  const from = Number(raw)
  const to = moveTarget(from, positionOf(event), props.section.items.length)
  if (to !== null) reorderItems(props.section.id, from, to)
}

function endDrag(): void {
  dragging.value = false
  dropAt.value = -1
}
</script>

<template>
  <article
    class="item-card"
    :class="{
      collapsed: !open,
      dragging,
      'drop-top': dropAt === index,
      'drop-bottom': dropAt === index + 1,
    }"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <header class="item-head">
      <span
        class="grip"
        draggable="true"
        title="拖动排序"
        @dragstart="onDragStart"
        @dragend="endDrag"
      >
        <GripVertical :size="14" />
      </span>
      <button class="chevron" :title="open ? '收起' : '展开'" @click="open = !open">
        <ChevronUp v-if="open" :size="15" />
        <ChevronDown v-else :size="15" />
      </button>
      <div class="item-summary">
        <strong>{{ summary }}</strong>
        <span v-if="meta">{{ meta }}</span>
      </div>
      <div class="item-actions">
        <button title="上移" :disabled="index === 0" @click="move(-1)">
          <ArrowUp :size="13" />
        </button>
        <button
          title="下移"
          :disabled="index === section.items.length - 1"
          @click="move(1)"
        >
          <ArrowDown :size="13" />
        </button>
        <button class="danger" title="删除" @click="remove">
          <Trash2 :size="13" />
        </button>
      </div>
    </header>

    <div v-show="open" class="item-body">
      <div class="field-grid two">
        <label v-for="key in fieldKeys" :key="key" class="field">
          <span>{{ FIELD_LABELS[key] ?? key }}</span>
          <input
            :value="item.fields[key] ?? ''"
            :placeholder="placeholders[key] ?? ''"
            @input="setField(key, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>

      <div class="block-label">要点</div>
      <BulletListEditor :target="item" />

      <button class="note-toggle" @click="noteOpen = !noteOpen">
        {{ noteOpen ? '收起补充说明' : '补充说明（Markdown）' }}
      </button>
      <textarea
        v-if="noteOpen"
        class="note"
        :value="item.note"
        placeholder="可选：补充段落或非列表 Markdown"
        @input="setNote(($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </div>
  </article>
</template>

<style scoped>
.item-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
}

.item-card.dragging {
  opacity: 0.45;
}

.item-card.drop-top {
  box-shadow: 0 -3px 0 -1px var(--accent);
}

.item-card.drop-bottom {
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

.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
}

.item-card.collapsed .item-head {
  border-bottom: 0;
}

.chevron {
  display: flex;
  flex: none;
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

.chevron:hover {
  background: var(--panel-tint);
}

.item-summary {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: baseline;
  gap: 8px;
}

.item-summary strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-summary span {
  overflow: hidden;
  flex: none;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-actions {
  display: flex;
  flex: none;
  gap: 2px;
}

.item-actions button {
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

.item-actions button:hover {
  background: var(--panel-tint);
  color: var(--text);
}

.item-actions button:disabled {
  opacity: 0.28;
  cursor: default;
}

.item-actions button.danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.item-body {
  padding: 12px;
}

.field-grid {
  display: grid;
  gap: 10px;
}

.field-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.field span {
  color: var(--muted);
  font-size: 10px;
}

.field input {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
  background: var(--panel-soft);
  color: var(--text);
  font-size: 12px;
}

.field input:focus {
  border-color: var(--accent);
  background: var(--panel);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.block-label {
  margin: 14px 0 6px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}

.note-toggle {
  margin-top: 10px;
  padding: 3px 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
}

.note-toggle:hover {
  color: var(--accent);
}

.note {
  width: 100%;
  min-height: 64px;
  margin-top: 6px;
  padding: 8px 9px;
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
  resize: vertical;
  background: var(--panel-soft);
  color: var(--text);
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  line-height: 1.6;
}

.note:focus {
  border-color: var(--accent);
  background: var(--panel);
}
</style>