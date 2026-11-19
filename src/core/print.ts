/** 通过隐藏 iframe 调起系统打印（可另存为 PDF） */
export async function printHtml(html: string): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    throw new Error('无法创建打印容器')
  }

  doc.open()
  doc.write(html)
  doc.close()

  await waitForLoad(iframe)
  await waitForAssets(iframe)
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  const win = iframe.contentWindow
  if (!win || typeof win.print !== 'function') {
    iframe.remove()
    throw new Error('当前环境不支持打印')
  }

  const cleanup = () => iframe.remove()
  win.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(cleanup, 90_000)

  win.focus()
  win.print()
}

function waitForLoad(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument
  if (!doc || doc.readyState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    iframe.addEventListener('load', () => resolve(), { once: true })
  })
}

async function waitForAssets(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument
  if (!doc) return
  const images = Array.from(doc.images).map((img) => img.decode().catch(() => undefined))
  await Promise.race([
    Promise.all([doc.fonts.ready, ...images]),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
}