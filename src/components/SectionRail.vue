<script setup lang="ts">
import { computed } from 'vue'
import { LayoutGrid, ListChecks, Palette, Plus, User } from 'lucide-vue-next'
import type { DraftSection } from '../core/draft'
import { SECTION_META } from '../core/types'
import { sectionIcon } from './sectionIcons'

const props = defineProps<{
  sections: DraftSection[]
  active: string
  lintCount: number
}>()

const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'add'): void
  (event: 'template'): void
}>()

const items = computed(() => [
  { id: 'layout', label: '布局', icon: LayoutGrid, badge: 0 },
  { id: 'basic', label: '基本信息', icon: User, badge: 0 },
  ...props.sections.map((section) => ({
    id: section.id,
    label: section.title || SECTION_META[section.type]?.label || '自定义章节',
    icon: sectionIcon(section.type),
    badge: 0,
  })),
  { id: 'lint', label: '简历质检', icon: ListChecks, badge: props.lintCount },
])
</script>

<template>
  <nav class="rail">
    <div class="rail-title">简历结构</div>
    <button
      v-for="item in items"
      :key="item.id"
      class="rail-item"
      :class="{ active: active === item.id }"
      :title="item.label"
      @click="emit('select', item.id)"
    >
      <component :is="item.icon" :size="17" class="rail-icon" />
      <span class="rail-label">{{ item.label }}</span>
      <span v-if="item.badge" class="rail-badge">{{ item.badge }}</span>
    </button>

    <div class="rail-spacer"></div>

    <button class="rail-item rail-secondary" title="模板与主题" @click="emit('template')">
      <Palette :size="17" class="rail-icon" />
      <span class="rail-label">模板与主题</span>
    </button>
    <button class="rail-add" title="添加模块" @click="emit('add')">
      <Plus :size="16" />
      <span class="rail-label">添加模块</span>
    </button>
  </nav>
</template>

<style scoped>
.rail {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 2px;
  padding: 16px 10px 12px;
  border-right: 1px solid var(--border);
  background: var(--panel);
  overflow-y: auto;
}

.rail-title {
  padding: 0 10px 8px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.rail-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-soft);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.rail-item:hover {
  background: var(--panel-tint);
  color: var(--text);
}

.rail-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.rail-badge {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--warn-soft);
  color: var(--warn-text);
  font-size: 10px;
  font-weight: 600;
}

.rail-icon {
  flex: none;
}

.rail-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-spacer {
  flex: 1;
}

.rail-secondary {
  margin-top: 8px;
  color: var(--muted);
}

.rail-add {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
  padding: 8px;
  border: 1px dashed var(--border-dashed);
  border-radius: 8px;
  background: var(--panel-soft);
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
}

.rail-add:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

@media (max-width: 1199px) {
  .rail {
    padding: 12px 8px;
  }

  .rail-title,
  .rail-label {
    display: none;
  }

  .rail-item {
    justify-content: center;
    padding: 10px 0;
  }

  .rail-add {
    padding: 10px 0;
  }
}
</style>