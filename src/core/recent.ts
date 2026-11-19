export interface RecentFile {
  path: string
  name: string
  at: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'resume.recentFiles.v1'

export function loadRecent(storage: StorageLike | null): RecentFile[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is RecentFile =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as RecentFile).path === 'string' &&
          typeof (item as RecentFile).name === 'string' &&
          typeof (item as RecentFile).at === 'number',
      )
      .slice(0, 8)
  } catch {
    return []
  }
}

export function saveRecent(storage: StorageLike | null, items: RecentFile[]): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 8)))
  } catch {
    /* 存储失败时忽略，最近文件不是关键数据 */
  }
}

export function pushRecent(
  items: RecentFile[],
  entry: RecentFile,
  limit = 8,
): RecentFile[] {
  return [entry, ...items.filter((item) => item.path !== entry.path)].slice(0, limit)
}

export function removeRecent(items: RecentFile[], path: string): RecentFile[] {
  return items.filter((item) => item.path !== path)
}

export function updateRecentName(
  items: RecentFile[],
  path: string,
  name: string,
): RecentFile[] {
  return items.map((item) => (item.path === path ? { ...item, name } : item))
}