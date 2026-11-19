<script setup lang="ts">
import { TEMPLATE_LIST } from '../core/render/templates'
import type { DocStyle, Spacing, TemplateId } from '../core/types'

defineProps<{ docStyle: DocStyle }>()
const emit = defineEmits<{ (event: 'change', patch: Partial<DocStyle>): void }>()

const accents = ['#2563eb', '#0f766e', '#7c3aed', '#b91c1c', '#c2410c', '#334155']
const spacings: { value: Spacing; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'normal', label: '标准' },
  { value: 'relaxed', label: '宽松' },
]

function setTemplate(template: TemplateId): void {
  emit('change', { template })
}

function setAccent(accent: string): void {
  emit('change', { accent })
}

function setFontSize(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) emit('change', { fontSize: value })
}

function setSpacing(spacing: Spacing): void {
  emit('change', { spacing })
}

function setAutoFit(event: Event): void {
  emit('change', { autoFit: (event.target as HTMLInputElement).checked })
}
</script>

<template>
  <div class="stylebar">
    <div class="group">
      <span class="label">模板</span>
      <button
        v-for="template in TEMPLATE_LIST"
        :key="template.id"
        class="pill"
        :class="{ active: template.id === docStyle.template }"
        @click="setTemplate(template.id)"
      >
        {{ template.name }}
      </button>
    </div>

    <div class="group">
      <span class="label">主题色</span>
      <button
        v-for="color in accents"
        :key="color"
        class="swatch"
        :class="{ active: color.toLowerCase() === docStyle.accent.toLowerCase() }"
        :style="{ background: color }"
        :title="color"
        @click="setAccent(color)"
      ></button>
      <input
        class="color-input"
        type="color"
        :value="docStyle.accent"
        title="自定义颜色"
        @input="setAccent(($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="group">
      <span class="label">字号</span>
      <input
        class="range"
        type="range"
        min="8.5"
        max="12"
        step="0.5"
        :value="docStyle.fontSize"
        @input="setFontSize"
      />
      <span class="value">{{ docStyle.fontSize.toFixed(1) }}pt</span>
    </div>

    <div class="group">
      <span class="label">间距</span>
      <button
        v-for="item in spacings"
        :key="item.value"
        class="pill"
        :class="{ active: item.value === docStyle.spacing }"
        @click="setSpacing(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <label class="group toggle">
      <input type="checkbox" :checked="docStyle.autoFit" @change="setAutoFit" />
      <span>自动一页</span>
    </label>
  </div>
</template>

<style scoped>
.stylebar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  padding: 8px 18px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}

.group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.pill {
  height: 26px;
  padding: 0 10px;
  border: 1px solid #dbe2ea;
  border-radius: 6px;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
}

.pill:hover {
  border-color: #94a3b8;
}

.pill.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}

.swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px #cbd5e1;
  cursor: pointer;
}

.swatch.active {
  box-shadow: 0 0 0 2px #1d4ed8;
}

.color-input {
  width: 26px;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.range {
  width: 90px;
}

.value {
  width: 40px;
  color: #64748b;
  font-size: 11px;
}

.toggle {
  gap: 5px;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
}
</style>