<script setup lang="ts">
import { computed } from 'vue'
import BasicInfoForm from './BasicInfoForm.vue'
import LayoutPanel from './LayoutPanel.vue'
import LintPanel from './LintPanel.vue'
import SectionForm from './SectionForm.vue'
import {
  activeSection,
  draft,
  editorState,
  formDiagnostics,
  lintIssues,
} from '../stores/editor'
import { SECTION_META } from '../core/types'

const title = computed(() => {
  if (editorState.activeView === 'layout') return '布局'
  if (editorState.activeView === 'basic') return '基本信息'
  if (editorState.activeView === 'lint') return '简历质检'
  const section = activeSection.value
  return section?.title || (section ? SECTION_META[section.type]?.label : '') || '章节'
})

const subtitle = computed(() => {
  if (editorState.activeView === 'layout') return '调整章节顺序与双栏位置'
  if (editorState.activeView === 'basic') return '简历抬头、头像与联系方式'
  if (editorState.activeView === 'lint') return '本地规则检查，不联网、不改动内容'
  return '章节内容'
})

function locate(sectionIndex: number): void {
  if (sectionIndex < 0) {
    editorState.activeView = 'basic'
    return
  }
  const section = draft.value?.sections[sectionIndex]
  if (section) editorState.activeView = section.id
}
</script>

<template>
  <section class="form-pane">
    <header class="form-head">
      <div>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </div>
    </header>
    <div class="form-scroll">
      <div v-if="formDiagnostics.length" class="form-alert">
        当前文档有 {{ formDiagnostics.length }} 条表单不完全支持的内容；保存时可能被重排或忽略。
      </div>
      <LayoutPanel v-if="editorState.activeView === 'layout'" />
      <LintPanel v-else-if="editorState.activeView === 'lint'" :issues="lintIssues" @select="locate" />
      <BasicInfoForm v-else-if="editorState.activeView === 'basic' && draft" />
      <SectionForm v-else-if="activeSection" :section="activeSection" />
      <div v-else class="form-placeholder">
        <div class="ph-mark">◌</div>
        <p>选择一个章节开始编辑</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.form-pane {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--app-bg);
}

.form-head {
  flex: none;
  padding: 22px 22px 10px;
}

.form-head h1 {
  margin: 0;
  color: var(--text);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.form-head p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.form-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 22px 28px;
}

.form-alert {
  margin-bottom: 10px;
  padding: 8px 10px;
  border: 1px solid var(--warn-border);
  border-radius: 8px;
  background: var(--warn-soft);
  color: var(--warn);
  font-size: 11px;
  line-height: 1.5;
}

.form-placeholder {
  display: flex;
  min-height: 240px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--border-dashed);
  border-radius: 14px;
  background: var(--panel);
  color: var(--muted);
  font-size: 12px;
}

.ph-mark {
  color: var(--accent);
  font-size: 28px;
}
</style>