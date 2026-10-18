const PINNED_REPOSITORY_IDS_KEY = "github-star.pinned-repository-ids"

export function readPinnedRepositoryIDs(): number[] {
  const saved = Storage.get<unknown>(PINNED_REPOSITORY_IDS_KEY)
  if (!Array.isArray(saved)) return []

  return saved.filter((id): id is number => typeof id === "number")
}

export function savePinnedRepositoryIDs(ids: number[]): boolean {
  const uniqueIDs = [...new Set(ids)]
  return Storage.set(PINNED_REPOSITORY_IDS_KEY, uniqueIDs)
}
