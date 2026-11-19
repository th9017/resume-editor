<script setup lang="ts">
import { computed } from 'vue'
import type { Diagnostic } from '../core/types'

const props = defineProps<{ diagnostics: Diagnostic[] }>()
const emit = defineEmits<{ (event: 'jump', line: number): void }>()

const items = computed(() => props.diagnostics.filter((item) => item.severity !== 'info'))
</script>

<template>
  <div v-if="items.length" class="diagnostics">
    <span class="label">语法提示</span>
    <button
      v-for="(item, index) in items"
      :key="`${item.line}-${item.code}-${index}`"
      class="diag"
      :class="item.severity"
      @click="emit('jump', item.line)"
    >
      <span class="line">L{{ item.line }}</span>
      <span class="message">{{ item.message }}</span>
    </button>
  </div>
</template>

<style scoped>
.diagnostics {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-height: 88px;
  overflow: auto;
  padding: 6px 12px;
  border-top: 1px solid #fde68a;
  background: #fffbeb;
  font-size: 11px;
}

.label {
  color: #b45309;
  font-weight: 600;
}

.diag {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border: 1px solid #fcd34d;
  border-radius: 999px;
  background: #ffffff;
  color: #92400e;
  font-size: 11px;
  cursor: pointer;
}

.diag:hover {
  filter: brightness(0.98);
}

.diag.error {
  border-color: #fca5a5;
  background: #fef2f2;
  color: #b91c1c;
}

.line {
  font-weight: 600;
}

.message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>