<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import { TEMPLATE_LIST } from '../core/render/templates'
import type { Spacing, TemplateId } from '../core/types'
import { draft, structuralEdit, touchDraft } from '../stores/editor'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (event: 'close'): void }>()

const docStyle = computed(() => draft.value?.style ?? null)
const accents = ['#2563eb', '#0f766e', '#7c3aed', '#b91c1c', '#c2410c', '#334155']
const spacings: { value: Spacing; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'normal', label: '标准' },
  { value: 'relaxed', label: '宽松' },
]

function setTemplate(template: TemplateId): void {
  if (!draft.value) return
  draft.value.style.template = template
  structuralEdit(`style:template:${template}`)
}

function setAccent(accent: string): void {
  if (!draft.value) return
  draft.value.style.accent = accent
  structuralEdit(`style:accent:${accent}`)
}

function onFontSize(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value) || !draft.value) return
  draft.value.style.fontSize = value
  touchDraft('style:font-size')
}

function setSpacing(spacing: Spacing): void {
  if (!draft.value) return
  draft.value.style.spacing = spacing
  structuralEdit(`style:spacing:${spacing}`)
}

function onAutoFit(event: Event): void {
  if (!draft.value) return
  draft.value.style.autoFit = (event.target as HTMLInputElement).checked
  structuralEdit('style:auto-fit')
}
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="backdrop" @click.self="emit('close')">
      <aside class="drawer">
        <header class="drawer-head">
          <div>
            <h2>模板与主题</h2>
            <p>切换后立即写入当前简历</p>
          </div>
          <button class="close" aria-label="关闭" @click="emit('close')">
            <X :size="18" />
          </button>
        </header>

        <div v-if="docStyle" class="drawer-body">
          <section>
            <h3>模板</h3>
            <div class="template-grid">
              <button
                v-for="tpl in TEMPLATE_LIST"
                :key="tpl.id"
                class="template-card"
                :class="{ active: docStyle.template === tpl.id }"
                @click="setTemplate(tpl.id)"
              >
                <div
                  class="thumb"
                  :class="`thumb-${tpl.id}`"
                  :style="{ '--thumb-accent': docStyle.accent }"
                >
                  <div v-if="tpl.id === 'sidebar'" class="t-side"></div>
                  <div class="t-head">
                    <div class="t-name"></div>
                    <div class="t-sub"></div>
                  </div>
                  <div class="t-line"></div>
                  <div class="t-line short"></div>
                  <div class="t-line"></div>
                  <div class="t-line"></div>
                </div>
                <span>{{ tpl.name }}</span>
              </button>
            </div>
          </section>

          <section>
            <h3>主题色</h3>
            <div class="swatches">
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
          </section>

          <section>
            <h3>字号 <em>{{ docStyle.fontSize.toFixed(1) }}pt</em></h3>
            <input
              class="range"
              type="range"
              min="8.5"
              max="12"
              step="0.5"
              :value="docStyle.fontSize"
              @input="onFontSize"
            />
          </section>

          <section>
            <h3>间距</h3>
            <div class="segmented">
              <button
                v-for="item in spacings"
                :key="item.value"
                :class="{ active: docStyle.spacing === item.value }"
                @click="setSpacing(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
          </section>

          <label class="switch-row">
            <span>自动一页</span>
            <input type="checkbox" :checked="docStyle.autoFit" @change="onAutoFit" />
          </label>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  justify-content: flex-end;
  background: rgba(20, 23, 40, 0.28);
}

.drawer {
  display: flex;
  width: min(380px, calc(100vw - 40px));
  height: 100%;
  flex-direction: column;
  background: #ffffff;
  box-shadow: -18px 0 48px rgba(20, 23, 40, 0.18);
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.drawer-head h2 {
  margin: 0;
  color: var(--text);
  font-size: 16px;
}

.drawer-head p {
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

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px 20px 28px;
}

section + section {
  margin-top: 22px;
}

h3 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 10px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}

h3 em {
  color: var(--muted);
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.template-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}

.template-card:hover {
  border-color: #c8cddb;
}

.template-card.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.thumb {
  position: relative;
  height: 118px;
  padding: 10px;
  overflow: hidden;
  border: 1px solid #eceef5;
  border-radius: 6px;
  background: #ffffff;
}

.t-side {
  position: absolute;
  inset: 0 auto 0 0;
  width: 34%;
  background: var(--thumb-accent);
  opacity: 0.12;
}

.thumb-sidebar .t-head,
.thumb-sidebar .t-line {
  margin-left: 38%;
}

.t-head {
  margin-bottom: 8px;
}

.t-name {
  width: 52%;
  height: 6px;
  border-radius: 3px;
  background: var(--thumb-accent);
}

.t-sub {
  width: 36%;
  height: 4px;
  margin-top: 4px;
  border-radius: 2px;
  background: #dfe3ee;
}

.t-line {
  width: 100%;
  height: 4px;
  margin-top: 6px;
  border-radius: 2px;
  background: #e8ebf3;
}

.t-line.short {
  width: 72%;
}

.thumb-compact {
  padding: 8px;
}

.thumb-compact .t-line {
  height: 3px;
  margin-top: 4px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px #cbd5e1;
  cursor: pointer;
}

.swatch.active {
  box-shadow: 0 0 0 2px var(--accent);
}

.color-input {
  width: 30px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.range {
  width: 100%;
  accent-color: var(--accent);
}

.segmented {
  display: flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: #f7f8fc;
}

.segmented button {
  flex: 1;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}

.segmented button.active {
  background: #ffffff;
  color: var(--accent);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(20, 23, 40, 0.08);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22px;
  color: var(--text);
  font-size: 12px;
}

.switch-row input {
  width: 34px;
  height: 20px;
  accent-color: var(--accent);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(24px);
}
</style>