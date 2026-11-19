<script setup lang="ts">
import { ref } from 'vue'
import { printHtml } from './core/print'
import { buildPrintSpikeHtml } from './samples/printSpike'

const printing = ref(false)
const message = ref('')

const source = ref(`---
name: 张一鸣
title: 高级前端工程师
---

:::: summary
## 个人简介
7 年前端经验，专注桌面端与数据密集型 Web 应用。
::::

:::: experience
## 工作经历

::: item
company: 蓝鲸科技
role: 高级前端工程师
period: 2022.06 — 至今
---
- 主导桌面端 Markdown 编辑器，首屏加载从 1.8s 降至 0.6s。
:::
::::`)

async function runPrintSpike(): Promise<void> {
  printing.value = true
  message.value = ''
  try {
    await printHtml(buildPrintSpikeHtml())
    message.value = '已调起打印预览，请按提示检查 A4 版式'
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  } finally {
    printing.value = false
    setTimeout(() => {
      message.value = ''
    }, 6000)
  }
}
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <div class="brand">
        简历编辑器
        <span class="tag">T1 · 打印 spike</span>
      </div>
      <div class="actions">
        <button class="btn primary" :disabled="printing" @click="runPrintSpike">
          {{ printing ? '准备打印…' : '打印 A4 测试' }}
        </button>
      </div>
    </header>

    <main class="workspace">
      <section class="pane editor-pane">
        <div class="pane-head">
          <span>Markdown 源码</span>
          <span class="muted">占位，T2/T4 接入解析与编辑器</span>
        </div>
        <textarea v-model="source" class="source" spellcheck="false" aria-label="Markdown 源码"></textarea>
      </section>

      <section class="pane preview-pane">
        <div class="pane-head">
          <span>A4 预览</span>
          <span class="muted">静态占位，T3 接入真实渲染</span>
        </div>
        <div class="preview-scroll">
          <article class="sheet demo-sheet">
            <header class="demo-header">
              <div>
                <div class="demo-name">张一鸣</div>
                <div class="demo-title">高级前端工程师</div>
              </div>
              <div class="demo-contact">
                <div>138-0000-0000</div>
                <div>zhang.yiming@example.com</div>
                <div>上海 · github.com/example</div>
              </div>
            </header>

            <section class="demo-section">
              <h2>个人简介</h2>
              <p>
                7 年前端经验，专注桌面端与数据密集型 Web 应用。擅长 TypeScript、Vue 3、Tauri
                与前端工程化，主导过 3 个从 0 到 1 的产品。
              </p>
            </section>

            <section class="demo-section">
              <h2>工作经历</h2>
              <div class="demo-item">
                <div class="demo-item-head">
                  <strong>蓝鲸科技 · 高级前端工程师</strong>
                  <span>2022.06 — 至今</span>
                </div>
                <ul>
                  <li>主导桌面端 Markdown 编辑器，首屏加载从 1.8s 降至 0.6s。</li>
                  <li>建立前端质量门禁，线上事故减少 50%。</li>
                </ul>
              </div>
              <div class="demo-item">
                <div class="demo-item-head">
                  <strong>海豚网络 · 前端工程师</strong>
                  <span>2019.07 — 2022.05</span>
                </div>
                <ul>
                  <li>负责数据看板迁移，页面渲染性能提升 2 倍。</li>
                </ul>
              </div>
            </section>

            <section class="demo-section">
              <h2>专业技能</h2>
              <p>TypeScript · Vue 3 · Tauri 2 · WebView2 · Vite · Vitest</p>
            </section>
          </article>
        </div>
      </section>
    </main>

    <footer class="statusbar">
      <span>未命名简历</span>
      <span class="dot">·</span>
      <span>A4 210×297mm</span>
      <span class="spacer"></span>
      <span>{{ message || '等待接入 Markdown 解析与 PDF 导出' }}</span>
    </footer>
  </div>
</template>