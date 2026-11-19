<script setup lang="ts">
import { ref } from 'vue'
import type { DraftSection } from '../core/draft'
import { SECTION_META } from '../core/types'
import { addItem, touchDraft } from '../stores/editor'
import BulletListEditor from './BulletListEditor.vue'
import ItemCard from './ItemCard.vue'

const props = defineProps<{ section: DraftSection }>()

const bodyOpen = ref(Boolean(props.section.body))
const skillsNoteOpen = ref(Boolean(props.section.body && props.section.type === 'skills'))

function setTitle(value: string): void {
  props.section.title = value
  touchDraft()
}

function setBody(value: string): void {
  props.section.body = value
  touchDraft()
}
</script>

<template>
  <div class="section-form">
    <div class="card">
      <label class="field">
        <span>章节标题</span>
        <input
          :value="section.title"
          placeholder="章节标题"
          @input="setTitle(($event.target as HTMLInputElement).value)"
        />
      </label>
      <p class="kind">
        {{ SECTION_META[section.type]?.label ?? '自定义章节' }}
        <template v-if="!SECTION_META[section.type]"> · 通用条目</template>
      </p>
    </div>

    <div v-if="section.type === 'summary'" class="card">
      <div class="card-title">内容</div>
      <textarea
        class="body-input"
        :value="section.body"
        placeholder="用 2-3 句话概括你的经历、方向和优势"
        @input="setBody(($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <p class="hint">支持 Markdown 文本。</p>
    </div>

    <template v-else-if="section.type === 'skills'">
      <div class="card">
        <div class="card-title">技能要点</div>
        <BulletListEditor :target="section" />
        <p class="hint">每行一条，可以在要点里使用 **粗体**。</p>
      </div>
      <div class="card soft">
        <button class="note-toggle" @click="skillsNoteOpen = !skillsNoteOpen">
          {{ skillsNoteOpen ? '收起补充说明' : '补充说明（Markdown）' }}
        </button>
        <textarea
          v-if="skillsNoteOpen"
          class="body-input small"
          :value="section.body"
          placeholder="可选：技能段落或其他 Markdown"
          @input="setBody(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>
    </template>

    <template v-else>
      <div class="card soft">
        <button class="note-toggle" @click="bodyOpen = !bodyOpen">
          {{ bodyOpen ? '收起章节说明' : '章节说明（可选）' }}
        </button>
        <textarea
          v-if="bodyOpen"
          class="body-input small"
          :value="section.body"
          placeholder="可选：章节导语或说明"
          @input="setBody(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>

      <div class="items">
        <ItemCard
          v-for="(item, index) in section.items"
          :key="item.id"
          :section="section"
          :item="item"
          :index="index"
        />
        <div v-if="section.items.length === 0" class="empty-items">
          还没有条目，添加一条开始填写。
        </div>
      </div>

      <button class="add-item" @click="addItem(section.id)">+ 添加条目</button>
    </template>
  </div>
</template>

<style scoped>
.section-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #ffffff;
}

.card.soft {
  padding: 10px 14px;
  background: #fbfbfe;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field span {
  color: var(--muted);
  font-size: 10px;
}

.field input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  background: #fbfbfe;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.field input:focus {
  border-color: var(--accent);
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(109, 93, 252, 0.1);
}

.kind {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 10px;
}

.card-title {
  margin-bottom: 9px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}

.body-input {
  width: 100%;
  min-height: 120px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  resize: vertical;
  background: #fbfbfe;
  color: var(--text);
  font-size: 12px;
  line-height: 1.7;
}

.body-input.small {
  min-height: 72px;
  margin-top: 6px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
}

.body-input:focus {
  border-color: var(--accent);
  background: #ffffff;
}

.hint {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 10px;
}

.note-toggle {
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
}

.note-toggle:hover {
  color: var(--accent);
}

.items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-items {
  padding: 22px;
  border: 1px dashed #d8dcea;
  border-radius: 10px;
  background: #ffffff;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}

.add-item {
  height: 36px;
  border: 1px dashed #cfd4e2;
  border-radius: 9px;
  background: #fbfbff;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
}

.add-item:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>