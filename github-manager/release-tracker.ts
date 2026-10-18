import { fetchRepositoryLatestRelease } from "./github-api"

const SUBSCRIPTIONS_KEY = "github-star.release-subscriptions"
const RELEASES_CACHE_KEY = "github-star.release-cache"

export type ReleaseSubscriptionInfo = {
  tag: string
  name: string
  publishedAt: string | null
  htmlUrl: string
  seen: boolean
  checkedAt: string
}

export function readReleaseSubscriptions(): string[] {
  return Storage.get<string[]>(SUBSCRIPTIONS_KEY) ?? []
}

export function saveReleaseSubscriptions(subscriptions: string[]): boolean {
  return Storage.set(SUBSCRIPTIONS_KEY, subscriptions)
}

export function isSubscribedToReleases(fullName: string): boolean {
  const subs = readReleaseSubscriptions()
  return subs.some(s => s.toLowerCase() === fullName.toLowerCase())
}

export function toggleReleaseSubscription(fullName: string): boolean {
  const subs = readReleaseSubscriptions()
  const exists = subs.some(s => s.toLowerCase() === fullName.toLowerCase())
  const next = exists
    ? subs.filter(s => s.toLowerCase() !== fullName.toLowerCase())
    : [...subs, fullName]
  saveReleaseSubscriptions(next)
  return !exists
}

export function addReleaseSubscription(fullName: string): boolean {
  const subs = readReleaseSubscriptions()
  if (!subs.some(s => s.toLowerCase() === fullName.toLowerCase())) {
    saveReleaseSubscriptions([...subs, fullName])
    return true
  }
  return false
}

export function removeReleaseSubscription(fullName: string): void {
  const subs = readReleaseSubscriptions()
  saveReleaseSubscriptions(subs.filter(s => s.toLowerCase() !== fullName.toLowerCase()))
}

export function readReleaseInfoMap(): Record<string, ReleaseSubscriptionInfo> {
  return Storage.get<Record<string, ReleaseSubscriptionInfo>>(RELEASES_CACHE_KEY) ?? {}
}

export function saveReleaseInfoMap(map: Record<string, ReleaseSubscriptionInfo>): boolean {
  return Storage.set(RELEASES_CACHE_KEY, map)
}

export function markReleaseAsRead(fullName: string): void {
  const map = readReleaseInfoMap()
  const key = Object.keys(map).find(k => k.toLowerCase() === fullName.toLowerCase()) ?? fullName
  if (map[key]) {
    map[key] = { ...map[key], seen: true }
    saveReleaseInfoMap(map)
  }
}

export function markAllReleasesAsRead(): void {
  const map = readReleaseInfoMap()
  let changed = false
  for (const k of Object.keys(map)) {
    if (!map[k].seen) {
      map[k] = { ...map[k], seen: true }
      changed = true
    }
  }
  if (changed) saveReleaseInfoMap(map)
}

export function getUnreadReleaseCount(): number {
  const subs = readReleaseSubscriptions()
  const map = readReleaseInfoMap()
  let count = 0
  for (const sub of subs) {
    const key = Object.keys(map).find(k => k.toLowerCase() === sub.toLowerCase())
    if (key && map[key] && !map[key].seen) {
      count++
    }
  }
  return count
}

export async function checkSingleRelease(fullName: string): Promise<ReleaseSubscriptionInfo | null> {
  const [owner, name] = fullName.split("/")
  if (!owner || !name) return null
  const rel = await fetchRepositoryLatestRelease(owner, name)
  if (!rel) return null
  const map = readReleaseInfoMap()
  const key = Object.keys(map).find(k => k.toLowerCase() === fullName.toLowerCase()) ?? fullName
  const prev = map[key]
  const isSeen = prev ? prev.tag === rel.tagName && prev.seen : false
  const info: ReleaseSubscriptionInfo = {
    tag: rel.tagName,
    name: rel.name || rel.tagName,
    publishedAt: rel.publishedAt ?? rel.createdAt,
    htmlUrl: rel.htmlUrl,
    seen: isSeen,
    checkedAt: new Date().toISOString(),
  }
  map[key] = info
  saveReleaseInfoMap(map)
  return info
}

export async function checkAllSubscriptions(
  onProgress?: (current: number, total: number, fullName: string) => void
): Promise<{ updatedCount: number; errors: string[] }> {
  const subs = readReleaseSubscriptions()
  const map = { ...readReleaseInfoMap() }
  let updatedCount = 0
  const errors: string[] = []

  for (let i = 0; i < subs.length; i++) {
    const fullName = subs[i]
    onProgress?.(i + 1, subs.length, fullName)
    const [owner, name] = fullName.split("/")
    if (!owner || !name) continue
    try {
      const rel = await fetchRepositoryLatestRelease(owner, name)
      if (rel) {
        const key = Object.keys(map).find(k => k.toLowerCase() === fullName.toLowerCase()) ?? fullName
        const prev = map[key]
        const isNew = prev ? prev.tag !== rel.tagName : true
        if (isNew) updatedCount++
        map[key] = {
          tag: rel.tagName,
          name: rel.name || rel.tagName,
          publishedAt: rel.publishedAt ?? rel.createdAt,
          htmlUrl: rel.htmlUrl,
          seen: prev ? (prev.tag === rel.tagName && prev.seen) : false,
          checkedAt: new Date().toISOString(),
        }
      }
    } catch (e: any) {
      errors.push(`${fullName}: ${e?.message ?? String(e)}`)
    }
  }

  saveReleaseInfoMap(map)
  return { updatedCount, errors }
}
