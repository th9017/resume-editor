<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-vue-next'
import {
  addDraftBullet,
  moveDraftBullet,
  removeDraftBullet,
} from '../core/draftActions'
import { touchDraft } from '../stores/editor'

const props = defineProps<{ target: { bullets: string[] } }>()
const host = ref<HTMLDivElement>()

function setBullet(index: number, value: string): void {
  props.target.bullets[index] = value
  touchDraft()
}

async function addBullet(): Promise<void> {
  addDraftBullet(props.target, props.target.bullets.length - 1)
  touchDraft()
  await nextTick()
  const inputs = host.value?.querySelectorAll('input')
  inputs?.[inputs.length - 1]?.focus()
}

function removeBullet(index: number): void {
  removeDraftBullet(props.target, index)
  touchDraft()
}

function moveBullet(index: number, delta: -1 | 1): void {
  moveDraftBullet(props.target, index, delta)
  touchDraft()
}
</script>

<template>
  <div ref="host" class="bullets">
    <div v-for="(bullet, index) in target.bullets" :key="index" class="bullet-row">
      <span class="bullet-dot">•</span>
      <input
        :value="bullet"
        placeholder="写一条成果或职责，尽量量化"
        @input="setBullet(index, ($event.target as HTMLInputElement).value)"
      />
      <button
        class="icon-btn"
        title="上移"
        :disabled="index === 0"
        @click="moveBullet(index, -1)"
      >
        <ArrowUp :size="13" />
      </button>
      <button
        class="icon-btn"
        title="下移"
        :disabled="index === target.bullets.length - 1"
        @click="moveBullet(index, 1)"
      >
        <ArrowDown :size="13" />
      </button>
      <button class="icon-btn danger" title="删除" @click="removeBullet(index)">
        <X :size="13" />
      </button>
    </div>
    <button class="add-bullet" @click="addBullet">
      <Plus :size="13" />
      添加要点
    </button>
  </div>
</template>

<style scoped>
.bullets {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bullet-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.bullet-dot {
  flex: none;
  color: var(--muted);
  font-size: 12px;
}

.bullet-row input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
  background: #fbfbfe;
  color: var(--text);
  font-size: 12px;
}

.bullet-row input:focus {
  border-color: var(--accent);
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(109, 93, 252, 0.1);
}

.icon-btn {
  display: flex;
  flex: none;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.icon-btn:hover {
  background: #f1f2f8;
  color: var(--text);
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.icon-btn.danger:hover {
  background: #fef2f2;
  color: #b91c1c;
}

.add-bullet {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  cursor: pointer;
}

.add-bullet:hover {
  background: var(--accent-soft);
}
</style>