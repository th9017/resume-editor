<script setup lang="ts">
import type { RecentFile } from '../core/recent'

defineProps<{ items: RecentFile[] }>()
const emit = defineEmits<{ (event: 'open', path: string): void }>()

function onChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  const path = select.value
  select.value = ''
  if (path) emit('open', path)
}
</script>

<template>
  <select
    class="recent-select"
    :disabled="items.length === 0"
    aria-label="最近文件"
    @change="onChange"
  >
    <option value="">{{ items.length ? '最近文件' : '无最近文件' }}</option>
    <option v-for="item in items" :key="item.path" :value="item.path">
      {{ item.name }} · {{ item.path }}
    </option>
  </select>
</template>

<style scoped>
.recent-select {
  max-width: 240px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid #d5dce6;
  border-radius: 7px;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
}

.recent-select:disabled {
  color: #94a3b8;
}
</style>