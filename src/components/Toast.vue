<script setup lang="ts">
import { appState } from '../stores/document'
</script>

<template>
  <transition name="toast">
    <div v-if="appState.toast" class="toast" :class="appState.toast.kind">
      {{ appState.toast.text }}
    </div>
  </transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 46px;
  left: 50%;
  z-index: 1300;
  max-width: 70vw;
  padding: 8px 16px;
  border-radius: 8px;
  background: #0f172a;
  color: #ffffff;
  font-size: 12px;
  line-height: 1.5;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.24);
  transform: translateX(-50%);
}

.toast.error {
  background: #b91c1c;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
</style>