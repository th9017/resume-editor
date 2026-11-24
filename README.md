# 简历编辑器（ResumeEditor）

本地优先、表单优先的 Markdown 简历编辑器。参考 [magic-resume](https://github.com/JOYCEQL/magic-resume) 的编辑体验，但**没有任何 AI 功能**，以 `.md` 文件为唯一保存格式，提供 Windows 绿色免安装版。

## 功能

- 三栏编辑：左侧章节导航、中间表单、右侧 A4 实时预览
- 表单直接编辑：基本信息、个人简介、工作经历、项目经历、教育背景、专业技能、荣誉奖项、自定义章节
- 条目卡片：增删、排序、字段编辑、结构化要点、可选 Markdown 补充说明
- 拖拽排序：布局页的章节、章节内的条目都可拖动手柄排序，上移/下移按钮保留
- 表单撤销/重做：误删章节、条目、要点后可逐步回退
- 布局页：调整章节顺序、删除章节、选择双栏模板中的主栏/侧栏位置
- 5 套模板：经典单栏、双栏侧栏、紧凑型、时间线、极简留白；模板抽屉支持主题色、字体、字号、间距、自动一页
- 深色模式：应用外壳跟随系统或手动切换，简历纸张始终白纸黑字
- 源码模式：直接编辑 Markdown，带诊断跳转；返回表单时提示不支持内容
- 单文档打开/保存/另存为、另存为副本、最近文件、800ms 自动保存、关闭前确认
- 普通 Markdown 导入：打开 `## 工作经历` 式文件时可选择自动整理成章节结构
- 头像与图片：图片写入 `.md` 同目录 `assets/`
- 页数估算、分页参考线、双栏超页自动降级单栏
- 导出 PDF：默认调用本机 Edge/Chrome 无头打印直接写文件，也可切回系统打印窗口
- 隐藏 iframe + `@page` A4 打印，作为系统打印回退路径
- 绿色免安装：解压 zip、双击 exe，设置存 exe 同目录 `data/settings.json`
- 无 AI、无网络请求、内容可携带

## 绿色版使用

1. 构建或获取 `ResumeEditor-portable.zip`。
2. 解压到任意可写目录。
3. 双击 `ResumeEditor.exe`（依赖 Windows 10/11 自带的 WebView2）。
4. `data/settings.json` 会保存最近文件、自动保存、直接导出 PDF、主题偏好，随文件夹移动。
5. 示例简历 `示例简历.md` 可直接用工具栏「打开」打开。

构建绿色版：

```bash
npm install
npm run build:portable
```

产物：`src-tauri/target/release/bundle/portable/ResumeEditor-portable.zip`。

也可以直接开发运行：

```bash
npm run tauri dev
```

NSIS 安装包作为可选产物：

```bash
npm run tauri build -- --bundles nsis
```

首次打包若无法访问 crates.io，可使用本地缓存：

```bash
CARGO_NET_OFFLINE=true npm run build:portable
```

首次 NSIS 打包还会下载 NSIS 3.13 工具包（含 `nsis_tauri_utils` 插件）；若 GitHub 不可达，可预先放入 `%LOCALAPPDATA%\tauri\NSIS`。

## 使用说明

- 左侧章节导航选择模块；中间表单编辑，右侧预览实时更新。
- 「布局」页调整章节顺序和双栏位置；拖动行左侧手柄换位置，误操作可 `Ctrl+Z` 撤销。
- 条目下的「要点」按行编辑；「补充说明」可写非列表 Markdown。
- 顶部「模板」打开模板与主题抽屉；「导出 PDF」直接选保存位置。
- 「更多」菜单包含新建、另存为、另存为副本、最近文件和源码模式；自动保存开关也在其中。
- 「另存为副本」在当前目录生成 `简历-副本.md`（重名自动加序号）并切换过去编辑；副本与原文件同目录，`assets/` 图片无需复制，适合按岗位维护多份简历。
- 「更多 → 外观」切换跟随系统 / 浅色 / 深色，偏好写入 `data/settings.json`；深色只作用于应用界面，简历纸张与导出 PDF 仍是白底。
- 快捷键：`Ctrl+S` 保存、`Ctrl+Shift+S` 另存为、`Ctrl+O` 打开、`Ctrl+N` 新建、`Ctrl+Z` 撤销、`Ctrl+Shift+Z` / `Ctrl+Y` 重做。
- 撤销覆盖章节/条目的增删排序与文本编辑；光标在输入框内时仍是浏览器逐字符撤销，点表单空白处或按钮后即为整步撤销。
- 导出 PDF：默认用本机 Edge 或 Chrome 无头打印直接生成矢量 PDF（字体子集内嵌，无页眉页脚）。想改用系统打印窗口，在「更多」里取消勾选「直接导出 PDF」，此时需选择 **A4 纵向、缩放 100%、勾选背景图形、关闭页眉页脚**。
- 有未保存修改时，新建/打开/关闭窗口会弹出“保存 / 不保存 / 取消”确认。
- 删除章节、删除条目、复制图片等不可逆操作使用应用内确认框（`Esc` 或点遮罩取消），不调用系统原生弹窗。

## Markdown 格式

表单保存为规范 Markdown：frontmatter + `::::` 章节 + `::: item` 条目。

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
  template: classic        # classic | sidebar | compact | timeline | minimal
  accent: "#2563eb"
  font: sans               # sans | serif
  font_size: 10.5          # pt，8.5–12
  spacing: normal          # compact | normal | relaxed
  auto_fit: true
---
```

### 章节与条目

- 章节：`:::: <type> [side|main]` 开始，`::::` 结束（4 个冒号）。
- 条目：`::: item` 开始，`:::` 结束（3 个冒号），只能位于章节内。
- 条目开头的连续 `key: value` 行是字段；`---` 之后是 `- ` 要点或补充 Markdown。
- 章节标题取第一个 `## 标题`；没有则使用类型默认标题。
- 代码块内的 `:::` 不解析；首版只支持“章节 → 条目”两层结构。

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
::::
```

内置章节类型：

| 类型 | 默认标题 | 常用字段 |
| --- | --- | --- |
| `summary` | 个人简介 | 正文 Markdown |
| `experience` | 工作经历 | company、role、period、location、stack、link |
| `projects` | 项目经历 | name、role、period、stack、link |
| `education` | 教育背景 | school、degree、major、period、location、gpa |
| `skills` | 专业技能 | 要点列表 |
| `awards` | 荣誉奖项 | title、issuer、date、link |
| `custom` | 自定义章节 | title、subtitle、period、location、link + 要点 |

示例文件见 [samples/example-resume.md](samples/example-resume.md)。

**格式边界**：表单只保证应用自身生成的格式。打开手写 Markdown 时，未知章节/字段会在表单模式中提示；源码切回表单前会弹出确认，避免静默覆盖。需要在任意 Markdown 中自由编辑时，使用「更多 → 源码模式」。

### 导入普通 Markdown

打开没有 `::::` 容器的 `.md` 时会询问是否自动整理。整理规则：

- `# 标题` → 姓名（frontmatter 已有 `name` 时忽略）。
- `## 工作经历` / `## Work Experience` 等常见中英文标题 → 对应内置章节；认不出来的成为自定义章节。
- `### 某公司` → 该章节的一个条目，标题写进主字段（公司/项目名/学校/标题）。
- `- 要点` → 条目要点；`## 专业技能` 下的要点直接作为技能列表。
- 段落文字 → 章节正文或条目补充说明。
- 第一个 `##` 之前的内容 → 归入个人简介。

选择不整理则保留原文并在源码模式中打开，文件内容不会被改写。

## 打印说明

- 纸张固定 A4 纵向，页边距由 `@page` 控制（上下 14mm、左右 16mm）。
- 打印 HTML 与屏幕预览共用模板 CSS；本地图片打印前内联为 data URL。
- 直接导出走 `msedge --headless --print-to-pdf`，使用临时 `--user-data-dir`，不干扰你正在浏览的窗口。
- 自动一页通过缩小根字号实现（下限 85%，双栏先试 90%）；屏幕与打印使用同一缩放。
- 双栏模板内容超过一页时，屏幕与打印统一降级单栏。
- 页数为估算，允许与系统打印预览存在 ±1 页差异。

## 项目结构

```text
src/
  core/                 解析、Draft 模型、序列化、渲染、分页、打印、图片、设置
  components/           三栏 UI、表单、模板抽屉、源码模式、对话框
  stores/               文档生命周期、自动保存、表单/源码状态
tests/                  Vitest 单元测试
src-tauri/              Tauri 2 Rust 工程与权限
samples/                可直接打开的示例简历
scripts/                绿色版打包
```

## 测试

```bash
npm test          # 133 个单元测试
npm run build     # vue-tsc + Vite 构建
cd src-tauri && cargo test --offline   # 含真实生成 PDF 的用例
npm run build:portable
```

原生文件对话框与绿色版运行需要在真实 Windows/WebView2 中人工验收；无头打印导出 PDF 已由 `cargo test` 在本机验证。

## 已知限制

- 表单只保证应用自身 Markdown 格式；复杂手写 Markdown 请用源码模式。
- 仅支持 UTF-8 的 `.md` 文件；不支持 DOCX/PDF 导入。
- 直接导出 PDF 依赖本机已安装 Edge 或 Chrome；两者都没有时自动回退系统打印窗口。
- 远程图片打印效果取决于网络；本地图片会被内联。
- Windows 优先；绿色版依赖 WebView2 运行时。
- 页数与分页位置为估算，最终以打印预览为准。

## 许可与致谢

- 产品形态参考 [Magic Resume](https://github.com/JOYCEQL/magic-resume)，未使用其源代码（其许可含非商用限制）。
- 文件/对话框封装与隐藏 iframe 打印思路源自 [MD-Editor](https://github.com/th9017/md-editor)（MIT）。详见 [NOTICE.md](NOTICE.md)。
