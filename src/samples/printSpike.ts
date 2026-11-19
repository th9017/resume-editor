const PRINT_CSS = `
@page { size: A4 portrait; margin: 14mm 16mm; }
html, body { margin: 0; padding: 0; background: #fff; color: #1f2937; }
* { box-sizing: border-box; }
body {
  font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
h2 { font-size: 1.25em; margin: 0 0 0.5em; color: #1e3a8a; }
.header {
  display: flex;
  justify-content: space-between;
  gap: 8mm;
  padding: 5mm 6mm;
  background: #eef4ff;
  border-left: 4px solid #2563eb;
  break-inside: avoid;
}
.header .name { font-size: 1.8em; font-weight: 700; letter-spacing: 0.04em; }
.header .title { color: #475569; margin-top: 2mm; }
.header .contact { text-align: right; color: #475569; font-size: 0.92em; line-height: 1.7; }
.two-col { display: grid; grid-template-columns: 60mm 1fr; gap: 6mm; margin-top: 6mm; }
.side { background: #eff6ff; padding: 5mm; border-radius: 2mm; }
.main { min-width: 0; }
.section { margin-top: 5mm; }
.item { padding: 3mm 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; }
.item:last-child { border-bottom: 0; }
.item-head { display: flex; justify-content: space-between; gap: 4mm; align-items: baseline; break-after: avoid; }
.item-head strong { font-size: 1.02em; }
.item-meta { color: #64748b; font-size: 0.9em; white-space: nowrap; }
.list { margin: 2mm 0 0; padding-left: 1.2em; }
.list li { margin: 1mm 0; break-inside: avoid; }
.tag { display: inline-block; padding: 0.5mm 2mm; margin: 0 1mm 1mm 0; background: #dbeafe; color: #1e40af; border-radius: 999px; font-size: 0.82em; }
.page-break { break-before: page; }
.note {
  margin-top: 8mm;
  padding: 3mm 4mm;
  border: 1px dashed #94a3b8;
  color: #475569;
  font-size: 0.9em;
  break-inside: avoid;
}
`

const BODY = `
<header class="header">
  <div>
    <div class="name">张一鸣</div>
    <div class="title">高级前端工程师</div>
  </div>
  <div class="contact">
    <div>138-0000-0000</div>
    <div>zhang.yiming@example.com</div>
    <div>上海 · github.com/example</div>
  </div>
</header>

<div class="two-col">
  <aside class="side">
    <h2>技能</h2>
    <div>
      <span class="tag">TypeScript</span><span class="tag">Vue 3</span>
      <span class="tag">Tauri 2</span><span class="tag">WebView2</span>
      <span class="tag">Vite</span><span class="tag">Vitest</span>
    </div>
    <h2 style="margin-top:6mm">教育</h2>
    <div class="item" style="padding-top:0">
      <strong>浙江大学</strong>
      <div class="item-meta">软件工程 · 本科</div>
      <div class="item-meta">2015.09 — 2019.06</div>
    </div>
  </aside>

  <main class="main">
    <section class="section" style="margin-top:0">
      <h2>个人简介</h2>
      <p>7 年前端经验，专注桌面端与数据密集型 Web 应用。擅长 TypeScript、Vue 3、Tauri 与前端工程化，主导过 3 个从 0 到 1 的产品。</p>
    </section>

    <section class="section">
      <h2>工作经历</h2>
      <div class="item">
        <div class="item-head">
          <strong>蓝鲸科技 · 高级前端工程师</strong>
          <span class="item-meta">2022.06 — 至今</span>
        </div>
        <ul class="list">
          <li>主导桌面端 Markdown 编辑器，首屏加载从 1.8s 降至 0.6s，崩溃率下降 70%。</li>
          <li>设计插件化文档架构，支撑 4 条业务线复用，需求交付周期缩短 30%。</li>
          <li>建立前端质量门禁（类型检查、单测、E2E），线上事故减少 50%。</li>
        </ul>
      </div>
      <div class="item">
        <div class="item-head">
          <strong>海豚网络 · 前端工程师</strong>
          <span class="item-meta">2019.07 — 2022.05</span>
        </div>
        <ul class="list">
          <li>负责数据看板从 jQuery 迁移到 React，页面渲染性能提升 2 倍。</li>
          <li>搭建组件库与 CI 流程，覆盖 80% 以上业务页面。</li>
        </ul>
      </div>
    </section>
  </main>
</div>

<section class="section">
  <h2>项目经历</h2>
  <div class="item">
    <div class="item-head">
      <strong>简历工坊 · 独立开发</strong>
      <span class="item-meta">2025</span>
    </div>
    <ul class="list">
      <li>以 Markdown 为唯一数据源，支持 3 套 A4 模板与自动一页缩放。</li>
      <li>打印管线统一预览与 PDF 输出，避免分页错位。</li>
    </ul>
  </div>
  <div class="item">
    <div class="item-head">
      <strong>Tauri 桌面工具集 · 核心开发</strong>
      <span class="item-meta">2023 — 2024</span>
    </div>
    <ul class="list">
      <li>封装文件、窗口、会话恢复等桌面能力，支撑多个内部工具复用。</li>
      <li>完成 Windows 安装包与便携版发布流程。</li>
    </ul>
  </div>
</section>

<div class="page-break"></div>

<section class="section" style="margin-top:0">
  <div class="note">
    打印测试第 2 页：本页由 <code>break-before: page</code> 强制分页。若你能看到本页、且上方内容没有出现应用界面，说明隐藏 iframe 打印与 @page 生效。
  </div>
  <h2 style="margin-top:6mm">教育背景</h2>
  <div class="item">
    <div class="item-head">
      <strong>浙江大学 · 软件工程</strong>
      <span class="item-meta">2015.09 — 2019.06</span>
    </div>
    <ul class="list">
      <li>主修课程：数据结构、操作系统、计算机网络、软件工程。</li>
      <li>GPA 3.8 / 4.0，校级优秀毕业生。</li>
    </ul>
  </div>
</section>

<section class="section">
  <h2>荣誉奖项</h2>
  <div class="item">
    <div class="item-head">
      <strong>年度技术之星</strong>
      <span class="item-meta">2024</span>
    </div>
    <p>蓝鲸科技年度技术之星，表彰在桌面端性能优化与工程质量建设上的贡献。</p>
  </div>
</section>

<section class="section">
  <h2>长内容分页测试</h2>
  <div class="item">
    <div class="item-head"><strong>条目不被从中间切断</strong><span class="item-meta">break-inside: avoid</span></div>
    <ul class="list">
      <li>这一段用于观察分页时条目是否整体下移，而不是被截断。</li>
      <li>同时检查第 2 页的左右页边距是否与第 1 页一致。</li>
      <li>检查背景色（浅蓝色块）是否在打印预览中显示。</li>
    </ul>
  </div>
</section>
`

export function buildPrintSpikeHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>张一鸣-简历</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${BODY}
</body>
</html>`
}