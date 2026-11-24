<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-vue-next'
import {
  fieldKeysFor,
  type DraftItem,
  type DraftSection,
} from '../core/draft'
import { FIELD_LABELS } from '../core/types'
import { moveItem, removeItem, touchDraft } from '../stores/editor'
import BulletListEditor from './BulletListEditor.vue'

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

function remove(): void {
  if (window.confirm('删除这个条目？')) removeItem(props.section.id, props.item.id)
}
</script>

<template>
  <article class="item-card" :class="{ collapsed: !open }">
    <header class="item-head">
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
  background: #ffffff;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f2f7;
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
  background: #f4f5fa;
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
  background: #f4f5fa;
  color: var(--text);
}

.item-actions button:disabled {
  opacity: 0.28;
  cursor: default;
}

.item-actions button.danger:hover {
  background: #fef2f2;
  color: #b91c1c;
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
  background: #fbfbfe;
  color: var(--text);
  font-size: 12px;
}

.field input:focus {
  border-color: var(--accent);
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(109, 93, 252, 0.1);
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
  background: #fbfbfe;
  color: var(--text);
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  line-height: 1.6;
}

.note:focus {
  border-color: var(--accent);
  background: #ffffff;
}
</style>