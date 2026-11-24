<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { confirmState, resolveDecision } from '../stores/document'

const actions = ref<HTMLDivElement>()

watch(
  () => confirmState.open,
  async (open) => {
    if (!open) return
    await nextTick()
    actions.value?.querySelector<HTMLButtonElement>('.btn')?.focus()
  },
)
</script>

<template>
  <div
    v-if="confirmState.open"
    class="modal-backdrop"
    @click.self="resolveDecision('cancel')"
    @keydown.esc="resolveDecision('cancel')"
  >
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h3 id="confirm-title">{{ confirmState.title }}</h3>
      <p>{{ confirmState.message }}</p>
      <div ref="actions" class="modal-actions">
        <button
          v-for="button in confirmState.buttons"
          :key="button.value"
          class="btn"
          :class="button.variant === 'default' ? null : button.variant"
          @click="resolveDecision(button.value)"
        >
          {{ button.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.38);
}

.modal {
  width: min(420px, calc(100vw - 40px));
  padding: 20px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
}

h3 {
  margin: 0 0 10px;
  color: #0f172a;
  font-size: 16px;
}

p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-line;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}
</style>
