/** 指针落在某行的下半部分则插到该行之后，否则之前 */
export function insertPosition(
  pointerY: number,
  rowTop: number,
  rowHeight: number,
  index: number,
): number {
  return pointerY > rowTop + rowHeight / 2 ? index + 1 : index
}

/**
 * 把"插入到原数组的 position 处"换算成先移除后插入的目标下标。
 * 位置等价或越界时返回 null，调用方据此跳过无意义的重排。
 */
export function moveTarget(from: number, position: number, length: number): number | null {
  if (!Number.isInteger(from) || from < 0 || from >= length) return null
  if (!Number.isInteger(position) || position < 0 || position > length) return null
  const to = position > from ? position - 1 : position
  return to === from ? null : to
}
