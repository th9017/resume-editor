import { appDataDir, join } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { loadRecent, type RecentFile, type StorageLike } from './recent'
import { isThemePreference, type ThemePreference } from './theme'

export interface AppSettings {
  version: 1
  recent: RecentFile[]
  autoSave: boolean
  printTipsDismissed: boolean
  theme: ThemePreference
}

export function defaultSettings(): AppSettings {
  return { version: 1, recent: [], autoSave: true, printTipsDismissed: false, theme: 'system' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecentFile(value: unknown): value is RecentFile {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.name === 'string' &&
    typeof value.at === 'number'
  )
}

export function normalizeSettings(raw: unknown): AppSettings {
  const defaults = defaultSettings()
  if (!isRecord(raw)) return defaults
  const recent = Array.isArray(raw.recent)
    ? raw.recent.filter(isRecentFile).slice(0, 8)
    : defaults.recent
  return {
    version: 1,
    recent,
    autoSave: typeof raw.autoSave === 'boolean' ? raw.autoSave : defaults.autoSave,
    printTipsDismissed:
      typeof raw.printTipsDismissed === 'boolean'
        ? raw.printTipsDismissed
        : defaults.printTipsDismissed,
    theme: isThemePreference(raw.theme) ? raw.theme : defaults.theme,
  }
}

export function legacySettingsFrom(storage: StorageLike | null): AppSettings {
  const settings = defaultSettings()
  if (!storage) return settings
  settings.recent = loadRecent(storage)
  try {
    const auto = storage.getItem('resume.autoSave.v1')
    settings.autoSave = auto == null ? true : auto === '1'
    settings.printTipsDismissed = storage.getItem('resume.printTipsDismissed.v1') === '1'
  } catch {
    /* 旧偏好读取失败时保留默认值 */
  }
  return settings
}

export interface SettingsLocation {
  dir: string
  file: string
  portable: boolean
}

let cachedLocation: SettingsLocation | null = null

export async function resolveSettingsLocation(): Promise<SettingsLocation> {
  try {
    const exeDir = await invoke<string | null>('exe_dir')
    if (exeDir && (await exists(await join(exeDir, 'portable.flag')))) {
      const dir = await join(exeDir, 'data')
      cachedLocation = { dir, file: await join(dir, 'settings.json'), portable: true }
      return cachedLocation
    }
  } catch {
    /* 无法读取 exe 目录时回退用户数据目录 */
  }
  const dir = await join(await appDataDir(), 'data')
  cachedLocation = { dir, file: await join(dir, 'settings.json'), portable: false }
  return cachedLocation
}

async function candidateLocations(): Promise<SettingsLocation[]> {
  const locations: SettingsLocation[] = []
  if (cachedLocation) locations.push(cachedLocation)
  try {
    const primary = await resolveSettingsLocation()
    if (!locations.some((location) => location.file === primary.file)) locations.push(primary)
  } catch {
    /* ignore */
  }
  try {
    const dir = await join(await appDataDir(), 'data')
    const fallback = { dir, file: await join(dir, 'settings.json'), portable: false }
    if (!locations.some((location) => location.file === fallback.file)) locations.push(fallback)
  } catch {
    /* ignore */
  }
  return locations
}

export async function loadAppSettings(): Promise<AppSettings> {
  const locations = await candidateLocations()
  const portable = locations.find((location) => location.portable)
  const readOrder = portable ? [portable] : locations
  for (const location of readOrder) {
    try {
      if (await exists(location.file)) {
        const settings = normalizeSettings(JSON.parse(await readTextFile(location.file)))
        cachedLocation = location
        return settings
      }
    } catch {
      /* 尝试下一个位置 */
    }
  }
  const legacy = legacySettingsFrom(typeof localStorage !== 'undefined' ? localStorage : null)
  await saveAppSettings(legacy)
  return legacy
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const data = JSON.stringify(settings, null, 2)
  const locations = await candidateLocations()
  for (const location of locations) {
    try {
      await mkdir(location.dir, { recursive: true })
      await writeTextFile(location.file, data)
      cachedLocation = location
      return
    } catch {
      /* 尝试下一个位置 */
    }
  }
}