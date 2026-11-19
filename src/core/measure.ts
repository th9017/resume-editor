import { searchFit, simulatePages, type BlockMetric } from './fit'
import { PAGE } from './page'
import { renderResume } from './render/renderer'
import type { TemplateDef } from './render/templates'
import type { ResumeDoc } from './types'

const MM_TO_PX = 96 / 25.4
const PAGE_CONTENT_PX = PAGE.contentHeightMm * MM_TO_PX

export interface MeasureContext {
  doc: ResumeDoc
  template: TemplateDef
  resolveImage?: (src: string) => string
}

export interface LayoutPlan {
  fit: number
  stacked: boolean
  pageCount: number
}

export async function measurePageCount(
  context: MeasureContext,
  fit: number,
  stacked: boolean,
): Promise<number> {
  const host = document.createElement('div')
  host.className = 'rv-measure-host'
  host.innerHTML = renderResume(context.doc, {
    template: context.template,
    fit,
    stacked,
    resolveImage: context.resolveImage,
  })
  document.body.appendChild(host)

  try {
    await document.fonts.ready
    const images = Array.from(host.querySelectorAll('img'))
    await Promise.race([
      Promise.all(images.map((image) => image.decode().catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])

    const article = host.querySelector('.rv')
    if (!article) return 1

    if (context.template.twoColumn && !stacked) {
      const height = article.getBoundingClientRect().height
      return Math.max(1, Math.ceil(height / PAGE_CONTENT_PX))
    }

    return simulatePages(collectBlocks(article), PAGE_CONTENT_PX).pages
  } finally {
    host.remove()
  }
}

export function collectBlocks(article: Element): BlockMetric[] {
  const rootTop = article.getBoundingClientRect().top
  const blocks: BlockMetric[] = []
  const add = (element: Element | null | undefined): void => {
    if (!element) return
    const rect = element.getBoundingClientRect()
    if (rect.height <= 0) return
    blocks.push({ top: rect.top - rootTop, height: rect.height })
  }

  add(article.querySelector('.rv-header'))

  for (const section of Array.from(article.querySelectorAll('.rv-section'))) {
    const title = section.querySelector('.rv-section-title')
    const bodyChildren = Array.from(
      section.querySelectorAll(':scope > .rv-section-body > *'),
    )
    const items = Array.from(section.querySelectorAll(':scope > .rv-items > .rv-item'))
    let bodyStart = 0
    let itemStart = 0

    if (title) {
      const next = bodyChildren[0] ?? items[0]
      if (next) {
        const titleRect = title.getBoundingClientRect()
        const nextRect = next.getBoundingClientRect()
        blocks.push({
          top: titleRect.top - rootTop,
          height: nextRect.bottom - titleRect.top,
        })
        if (bodyChildren[0]) bodyStart = 1
        else itemStart = 1
      } else {
        add(title)
      }
    }

    for (let index = bodyStart; index < bodyChildren.length; index++) add(bodyChildren[index])
    for (let index = itemStart; index < items.length; index++) add(items[index])
  }

  return blocks
}

export async function computeLayoutPlan(context: MeasureContext): Promise<LayoutPlan> {
  const autoFit = context.doc.style.autoFit
  const basePages = await measurePageCount(context, 1, false)

  if (context.template.twoColumn) {
    if (basePages <= 1) return { fit: 1, stacked: false, pageCount: 1 }

    if (autoFit) {
      const fit = await searchFit(
        (value) => measurePageCount(context, value, false),
        0.9,
      )
      if (fit != null) return { fit, stacked: false, pageCount: 1 }
    }

    const stackedPages = await measurePageCount(context, 1, true)
    if (stackedPages <= 1) return { fit: 1, stacked: true, pageCount: 1 }

    if (autoFit) {
      const fit = await searchFit(
        (value) => measurePageCount(context, value, true),
        0.85,
      )
      if (fit != null) return { fit, stacked: true, pageCount: 1 }
      const pageCount = await measurePageCount(context, 0.85, true)
      return { fit: 0.85, stacked: true, pageCount }
    }

    return { fit: 1, stacked: true, pageCount: stackedPages }
  }

  if (!autoFit || basePages <= 1) {
    return { fit: 1, stacked: false, pageCount: basePages }
  }

  const fit = await searchFit(
    (value) => measurePageCount(context, value, false),
    0.85,
  )
  if (fit != null) return { fit, stacked: false, pageCount: 1 }

  const pageCount = await measurePageCount(context, 0.85, false)
  return { fit: 0.85, stacked: false, pageCount }
}