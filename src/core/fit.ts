export interface BlockMetric {
  top: number
  height: number
}

export interface PagePlan {
  pages: number
}

/** 按块位置与高度模拟分页，允许超长块内部断页 */
export function simulatePages(blocks: BlockMetric[], pageHeight: number): PagePlan {
  const sorted = blocks.filter((block) => block.height > 0).sort((a, b) => a.top - b.top)
  if (sorted.length === 0 || pageHeight <= 0) return { pages: 1 }

  let pages = 1
  let used = 0
  let previousBottom = 0

  for (const block of sorted) {
    const gap = Math.max(0, block.top - previousBottom)
    if (used > 0 && used + gap >= pageHeight) {
      pages++
      used = 0
    } else if (used > 0) {
      used += gap
    }

    if (used + block.height <= pageHeight) {
      used += block.height
    } else if (block.height > pageHeight) {
      const total = used + block.height
      const span = Math.ceil(total / pageHeight)
      pages += span - 1
      used = total - (span - 1) * pageHeight
    } else {
      pages++
      used = block.height
    }

    previousBottom = block.top + block.height
  }

  return { pages }
}

/** 二分查找能压到一页的最大缩放；返回 null 表示下限仍超过一页 */
export async function searchFit(
  measure: (fit: number) => Promise<number>,
  minFit: number,
  maxFit = 1,
  iterations = 6,
): Promise<number | null> {
  const highPages = await measure(maxFit)
  if (highPages <= 1) return maxFit

  const lowPages = await measure(minFit)
  if (lowPages > 1) return null

  let low = minFit
  let high = maxFit
  let best = minFit
  for (let index = 0; index < iterations; index++) {
    const mid = (low + high) / 2
    const pages = await measure(mid)
    if (pages <= 1) {
      best = mid
      low = mid
    } else {
      high = mid
    }
  }

  return Math.floor(best * 100) / 100
}