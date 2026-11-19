<script setup lang="ts">
import { computed } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import { addSection, draft, editorState } from '../stores/editor'
import { SECTION_OPTIONS } from '../core/types'
import { sectionIcon } from './sectionIcons'

const options = computed(() => {
  const existing = new Set(draft.value?.sections.map((section) => section.type) ?? [])
  const known = SECTION_OPTIONS.filter((option) => !existing.has(option.type)).map((option) => ({
    ...option,
    icon: sectionIcon(option.type),
  }))
  return [...known, { type: 'custom', label: '自定义章节', icon: Plus }]
})

function choose(type: string): void {
  addSection(type)
  editorState.addMenuOpen = false
}

function close(): void {
  editorState.addMenuOpen = false
}
</script>

<template>
  <div v-if="editorState.addMenuOpen" class="backdrop" @click.self="close">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="add-section-title">
      <header class="head">
        <div>
          <h2 id="add-section-title">添加模块</h2>
          <p>已存在的章节类型不会重复出现。</p>
        </div>
        <button class="close" aria-label="关闭" @click="close">
          <X :size="18" />
        </button>
      </header>
      <div class="grid">
        <button
          v-for="option in options"
          :key="option.type"
          class="option"
          @click="choose(option.type)"
        >
          <component :is="option.icon" :size="18" />
          <span>{{ option.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1150;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 23, 40, 0.28);
}

.modal {
  width: min(500px, calc(100vw - 40px));
  padding: 18px;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 24px 64px rgba(20, 23, 40, 0.24);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.head h2 {
  margin: 0;
  color: var(--text);
  font-size: 16px;
}

.head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.close {
  display: flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: #f5f6fa;
  color: var(--muted);
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.option:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
</style>