import type { SiteNotice, StoreScript } from "./store-api"

// 商店列表快照：只保留最近一次成功加载的结果，每次刷新整体覆盖，不累积。
const CACHE_KEY = "script-store.cache"
// 数据结构变化时递增，旧快照直接作废。
const CACHE_VERSION = 1

export type StoreSnapshot = {
  version: number
  scripts: StoreScript[]
  notice: SiteNotice
  savedAt: number
}

export function readSnapshot(): StoreSnapshot | null {
  const value = Storage.get<StoreSnapshot>(CACHE_KEY)
  if (!value || value.version !== CACHE_VERSION || !Array.isArray(value.scripts)) return null
  return value
}

export function saveSnapshot(scripts: StoreScript[], notice: SiteNotice): StoreSnapshot {
  const snapshot = { version: CACHE_VERSION, scripts, notice, savedAt: Date.now() }
  Storage.set(CACHE_KEY, snapshot)
  return snapshot
}

/** 「今天 14:05」「10-18 09:30」。 */
export function formatSavedAt(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, "0")
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return date.toDateString() === new Date().toDateString() ? `今天 ${time}` : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`
}
