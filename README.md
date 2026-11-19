# 简历编辑器（ResumeEditor）

本地优先的 Markdown 简历编辑器。参考 [magic-resume](https://github.com/JOYCEQL/magic-resume) 的产品形态，但**不包含任何 AI 功能**。以 `.md` 文件为唯一数据源，实时渲染 A4 简历，并通过系统打印另存为 PDF。

## 功能

- Markdown 源码编辑（CodeMirror 6）+ 实时 A4 预览
- 3 套模板：经典单栏、双栏侧栏、紧凑型
- 主题色、字号、间距、自动一页缩放
- 自定义 `::::` 章节 / `::: item` 条目容器
- 插入助手：章节、条目、个人信息、头像
- 单文档打开 / 保存 / 另存为、800ms 自动保存、最近文件
- 粘贴图片到同目录 `assets/`，头像路径写入 frontmatter
- 页数估算、分页参考线、双栏超页自动降级单栏
- 隐藏 iframe + `@page` A4 打印，另存为 PDF
- 完全本地：无网络请求、无 AI、Markdown 内容可移植

## 技术栈

Tauri 2 · Vue 3 · TypeScript · Vite · CodeMirror 6 · markdown-it · yaml · Vitest

## 快速开始

环境：Windows 10/11、Node.js 20+、Rust stable、WebView2。

```bash
npm install
npm run tauri dev
```

构建 NSIS 安装包：

```bash
npm run build
npm run tauri build -- --bundles nsis
```

安装包位于 `src-tauri/target/release/bundle/nsis/`。首次构建若无法访问 crates.io，可使用本地缓存：

```bash
CARGO_NET_OFFLINE=true npm run tauri build -- --bundles nsis
```

首次打包还会下载 NSIS 3.13 工具包（含 `nsis_tauri_utils` 插件）。若 GitHub 不可达，可预先将官方 NSIS 3.13 与 `Plugins/x86-unicode/additional/nsis_tauri_utils.dll` 放入 `%LOCALAPPDATA%\tauri\NSIS`。

## 使用说明

- 工具栏：新建 / 打开 / 保存 / 另存为 / 最近文件 / 导出 PDF。
- 样式栏：模板、主题色、字号、间距、自动一页。
- 插入栏：选择章节类型后插入章节、条目、个人信息或头像。
- 快捷键：`Ctrl+S` 保存、`Ctrl+Shift+S` 另存为、`Ctrl+O` 打开、`Ctrl+N` 新建。
- 图片：需先保存文档；粘贴图片或将头像写入文档同目录的 `assets/`。SVG 不支持。
- 导出 PDF：按弹窗提示在系统打印窗口中选择 **A4 纵向、缩放 100%、勾选背景图形、关闭页眉页脚**，然后另存为 PDF。
- 有未保存修改时，新建/打开/关闭窗口会弹出“保存 / 不保存 / 取消”确认。

## Markdown 格式

### frontmatter

```yaml
---
name: 张一鸣
title: 高级前端工程师
contact:
  phone: "138-0000-0000"
  email: zhang.yiming@example.com
  location: 上海
  website: https://example.com
  github: github.com/example
avatar: assets/avatar.jpg
style:
  template: classic        # classic | sidebar | compact
  accent: "#2563eb"
  font_size: 10.5          # pt，8.5–12
  spacing: normal          # compact | normal | relaxed
  auto_fit: true
---
```

文档外观（模板、主题色、字号、间距、自动一页）保存在 frontmatter 中，随 `.md` 文件一起分享。

### 章节与条目

- 章节：`:::: <type> [side|main]` 开始，`::::` 结束（4 个冒号）。
- 条目：`::: item` 开始，`:::` 结束（3 个冒号），只能位于章节内。
- 条目开头的连续 `key: value` 行是字段；`---` 之后是 Markdown 正文。
- 章节标题取第一个 `## 标题`；没有则使用类型默认标题。
- 代码块（``` 或 ~~~）内的 `:::` 不会被解析。
- 首版只支持“章节 → 条目”两层结构，不支持任意嵌套。

```md
:::: experience
## 工作经历

::: item
company: 蓝鲸科技
role: 高级前端工程师
period: 2022.06 — 至今
location: 上海
stack: TypeScript / Vue 3 / Tauri
---
- 主导桌面端 Markdown 编辑器，首屏加载从 1.8s 降至 0.6s。
- 建立前端质量门禁，线上事故减少 50%。
:::

::: item
company: 海豚网络
role: 前端工程师
period: 2019.07 — 2022.05
---
- 负责数据看板迁移，页面渲染性能提升 2 倍。
:::
::::
```

内置章节类型：

| 类型 | 默认标题 | 常用字段 |
| --- | --- | --- |
| `summary` | 个人简介 | 正文 Markdown |
| `experience` | 工作经历 | company、role、period、location、stack、link |
| `projects` | 项目经历 | name、role、period、stack、link |
| `education` | 教育背景 | school、degree、major、period、location、gpa |
| `skills` | 专业技能 | 正文 Markdown |
| `awards` | 荣誉奖项 | title、issuer、date、link |

未知章节类型会降级为自定义章节并显示语法提示。示例文件见 [samples/example-resume.md](samples/example-resume.md)。

## 打印说明

- 纸张固定 A4 纵向，页边距由 `@page` 控制（上下 14mm、左右 16mm）。
- 打印 HTML 与屏幕预览共用同一套模板 CSS；本地图片在打印前内联为 data URL。
- 自动一页通过缩小根字号实现（下限 85%，双栏先试 90%）；屏幕与打印使用同一缩放比例。
- 双栏模板内容超过一页时，屏幕与打印统一降级为单栏，避免跨页背景碎裂。
- 页数提示为估算值，允许与系统打印预览存在 ±1 页差异。

## 项目结构

```text
src/
  core/                 解析、渲染、分页、打印、图片、路径
  components/           编辑器、预览、样式栏、对话框
  stores/              单文档状态、自动保存、最近文件
  samples/             新建文档骨架与完整示例
tests/                  Vitest 单元测试
src-tauri/             Tauri 2 Rust 工程与权限
samples/               可直接打开的示例简历
```

## 测试

```bash
npm test          # 85 个单元测试
npm run build     # vue-tsc + Vite 构建
cd src-tauri && cargo check --offline
```

UI 与系统打印需要在真实 WebView2 中手动验收。

## 已知限制

- 仅支持 UTF-8 的 `.md` 文件；不支持 DOCX/PDF 导入。
- 打印依赖系统打印窗口（另存为 PDF），不提供一键直存。
- 远程图片的打印效果取决于网络；本地图片会被内联。
- Windows 优先；当前只配置 NSIS 打包。
- 页数、分页位置为估算，最终以打印预览为准。

## 许可与致谢

- 产品形态参考 [Magic Resume](https://github.com/JOYCEQL/magic-resume)，未使用其源代码（其许可含非商用限制）。
- 文件/对话框封装与隐藏 iframe 打印思路源自 [MD-Editor](https://github.com/th9017/md-editor)（MIT）。详见 [NOTICE.md](NOTICE.md)。