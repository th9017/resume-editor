export const SHOWCASE_MARKDOWN = `---
name: 张一鸣
title: 高级前端工程师
contact:
  phone: "138-0000-0000"
  email: zhang.yiming@example.com
  location: 上海
  website: https://example.com
  github: github.com/example
style:
  template: classic
  accent: "#2563eb"
  font_size: 10.5
  spacing: normal
  auto_fit: true
---

:::: summary
## 个人简介
7 年前端经验，专注桌面端与数据密集型 Web 应用。擅长 TypeScript、Vue 3、Tauri 与前端工程化，
主导过 3 个从 0 到 1 的产品，关注性能、可维护性与交付质量。
::::

:::: experience
## 工作经历

::: item
company: 蓝鲸科技
role: 高级前端工程师
period: 2022.06 — 至今
location: 上海
stack: TypeScript / Vue 3 / Tauri
link: https://example.com/team
---
- 主导桌面端 Markdown 编辑器，首屏加载从 1.8s 降至 0.6s，崩溃率下降 70%。
- 设计插件化文档架构，支撑 4 条业务线复用，需求交付周期缩短 30%。
- 建立前端质量门禁（类型检查、单测、E2E），线上事故减少 50%。
:::

::: item
company: 海豚网络
role: 前端工程师
period: 2019.07 — 2022.05
location: 杭州
stack: React / Node.js / Webpack
---
- 负责数据看板从 jQuery 迁移到 React，页面渲染性能提升 2 倍。
- 搭建组件库与 CI 流程，覆盖 80% 以上业务页面。
:::
::::

:::: projects
## 项目经历

::: item
name: 简历工坊
role: 独立开发
period: 2025
stack: Tauri 2 / Vue 3 / CodeMirror 6
link: https://github.com/example/resume
---
- 以 Markdown 为唯一数据源，支持 3 套 A4 模板与自动一页缩放。
- 打印管线统一预览与 PDF 输出，避免分页错位。
:::
::::

:::: education side
## 教育背景

::: item
school: 浙江大学
degree: 本科
major: 软件工程
period: 2015.09 — 2019.06
location: 杭州
gpa: 3.8 / 4.0
:::
::::

:::: skills
## 专业技能
- **前端**：TypeScript、Vue 3、React、CSS 架构
- **桌面端**：Tauri 2、WebView2、Node.js
- **工程化**：Vite、Vitest、CI/CD、性能优化
::::

:::: awards
## 荣誉奖项

::: item
title: 年度技术之星
issuer: 蓝鲸科技
date: 2024
---
:::
::::
`