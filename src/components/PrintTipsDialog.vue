<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (event: 'confirm', dontShow: boolean): void
  (event: 'cancel'): void
}>()

const dontShow = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) dontShow.value = false
  },
)

function confirm(): void {
  emit('confirm', dontShow.value)
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="print-tips-title">
      <h3 id="print-tips-title">导出 PDF 前的设置</h3>
      <ul class="tips">
        <li><strong>纸张</strong>：A4 纵向，缩放 100%</li>
        <li><strong>边距</strong>：默认（由简历页面控制）</li>
        <li><strong>背景</strong>：勾选“背景图形”</li>
        <li><strong>页眉页脚</strong>：关闭</li>
        <li><strong>目标</strong>：另存为 PDF / Microsoft Print to PDF</li>
      </ul>
      <p class="hint">系统打印窗口因浏览器与驱动而异，以上选项可保证版面与预览一致。</p>
      <label class="dont-show">
        <input v-model="dontShow" type="checkbox" />
        <span>不再提示</span>
      </label>
      <div class="modal-actions">
        <button class="btn" @click="emit('cancel')">取消</button>
        <button class="btn primary" @click="confirm">继续导出</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1250;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay);
}

.modal {
  width: min(480px, calc(100vw - 40px));
  padding: 20px;
  border-radius: 12px;
  background: var(--panel);
  box-shadow: 0 24px 64px var(--shadow-color);
}

h3 {
  margin: 0 0 12px;
  color: var(--text-strong);
  font-size: 16px;
}

.tips {
  margin: 0;
  padding-left: 18px;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.9;
}

.hint {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.dont-show {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  color: var(--text-soft);
  font-size: 12px;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>