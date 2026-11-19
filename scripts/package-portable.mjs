// 打包绿色版 zip：ResumeEditor.exe + portable.flag + 示例简历 + 使用说明
// 前置：先运行 npm run tauri build -- --no-bundle（产出 release exe）
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const exeSrc = join(root, 'src-tauri', 'target', 'release', 'resume.exe')
const outDir = join(root, 'src-tauri', 'target', 'release', 'bundle', 'portable')

if (!existsSync(exeSrc)) {
  console.error('未找到 release exe，请先运行: npm run tauri build -- --no-bundle')
  process.exit(1)
}

const stage = join(outDir, 'ResumeEditor-portable')
rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })

copyFileSync(exeSrc, join(stage, 'ResumeEditor.exe'))
writeFileSync(join(stage, 'portable.flag'), '')
copyFileSync(join(root, 'samples', 'example-resume.md'), join(stage, '示例简历.md'))
writeFileSync(
  join(stage, '使用说明.txt'),
  [
    '简历编辑器 绿色版',
    '',
    '- 双击 ResumeEditor.exe 运行，免安装（依赖 Windows 自带的 WebView2）',
    '- 偏好保存在 data/settings.json，随文件夹移动',
    '- 简历保存为 .md，图片在 .md 同目录的 assets/ 下',
    '- 示例简历.md 可直接用「打开」打开',
    '',
  ].join('\r\n'),
)

const zip = join(outDir, 'ResumeEditor-portable.zip')
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${stage}\\*' -DestinationPath '${zip}' -Force"`,
  { stdio: 'inherit' },
)
console.log('便携包已生成：' + zip)
