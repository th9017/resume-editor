<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { openExternal } from '../tauri'

const props = defineProps<{ html: string; pageCount: number }>()
const scrollRef = ref<HTMLDivElement>()
const zoom = ref(1)
let observer: ResizeObserver | null = null

const guidePages = computed(() => {
  const count = Math.max(0, props.pageCount - 1)
  return Array.from({ length: count }, (_, index) => index + 1)
})

function updateZoom(): void {
  const element = scrollRef.value
  if (!element) return
  const available = element.clientWidth - 48
  const sheetWidth = (210 * 96) / 25.4
  zoom.value = Math.max(0.2, Math.min(1, available / sheetWidth))
}

onMounted(() => {
  observer = new ResizeObserver(updateZoom)
  if (scrollRef.value) observer.observe(scrollRef.value)
  updateZoom()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  const anchor = target?.closest('a')
  if (!anchor) return
  const href = anchor.getAttribute('href') ?? ''
  event.preventDefault()
  if (/^(https?:|mailto:|tel:)/i.test(href)) void openExternal(href)
}
</script>

<template>
  <div ref="scrollRef" class="preview-scroll">
    <div class="rv-stage">
      <div class="rv-sheet" :style="{ zoom }" @click="onClick">
        <div
          v-for="page in guidePages"
          :key="page"
          class="rv-guide"
          :style="{ top: `${page * 297}mm` }"
        >
          <span>第 {{ page + 1 }} 页</span>
        </div>
        <div v-if="props.html" v-html="props.html"></div>
        <div v-else class="rv-empty">在左侧输入内容开始预览</div>
      </div>
    </div>
  </div>
</template>