<script setup lang="ts">
import { computed } from 'vue'
import { LINT_SEVERITY_LABEL, type LintIssue, type LintSeverity } from '../core/lint'

const props = defineProps<{ issues: LintIssue[] }>()
const emit = defineEmits<{ (event: 'select', sectionIndex: number): void }>()

const groups = computed(() => {
  const order: LintSeverity[] = ['error', 'warn', 'info']
  return order
    .map((severity) => ({
      severity,
      label: LINT_SEVERITY_LABEL[severity],
      items: props.issues.filter((issue) => issue.severity === severity),
    }))
    .filter((group) => group.items.length > 0)
})

const clean = computed(() => props.issues.length === 0)
</script>

<template>
  <div class="lint-panel">
    <div class="lint-hint">
      本地规则检查：只看结构、时间、标点和量化数据，不联网、不改动内容。
    </div>

    <div v-if="clean" class="card clean">
      <div class="clean-mark">✓</div>
      <p>没有发现问题。排版效果仍以右侧 A4 预览为准。</p>
    </div>

    <section v-for="group in groups" :key="group.severity" class="card">
      <div class="card-title">
        <span>{{ group.label }}</span>
        <em>{{ group.items.length }}</em>
      </div>
      <ul>
        <li v-for="(issue, index) in group.items" :key="`${issue.code}-${index}`">
          <div class="text">
            <span class="message">{{ issue.message }}</span>
            <span class="code">{{ issue.code }}</span>
          </div>
          <button class="locate" @click="emit('select', issue.sectionIndex)">
            {{ issue.sectionIndex < 0 ? '去基本信息' : '定位章节' }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.lint-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lint-hint {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-soft);
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
}

.card.clean {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-soft);
  font-size: 12px;
}

.clean-mark {
  display: flex;
  width: 24px;
  height: 24px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
}

.card p {
  margin: 0;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}

.card-title em {
  padding: 1px 7px;
  border-radius: 8px;
  background: var(--panel-tint);
  color: var(--text-soft);
  font-size: 11px;
  font-style: normal;
}

ul {
  display: flex;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-soft);
}

li:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.message {
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.code {
  color: var(--muted);
  font-family: Consolas, "Courier New", monospace;
  font-size: 10px;
}

.locate {
  flex: none;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--panel-tint);
  color: var(--text-soft);
  font-size: 11px;
  cursor: pointer;
}

.locate:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
