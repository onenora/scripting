import { useEffect, useState } from "scripting"
import type { GitHubRepository } from "./types"

const FAVORITES_KEY = "github-star.favorites"

/** 本地收藏：保存仓库快照，与 GitHub 账户、Token 无关，不会 Star。 */
export type FavoriteRepository = GitHubRepository & { favoritedAt: string }

const listeners = new Set<() => void>()

function sameRepository(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

export function readFavorites(): FavoriteRepository[] {
  const saved = Storage.get<FavoriteRepository[]>(FAVORITES_KEY)
  return Array.isArray(saved) ? [...saved].sort((left, right) => right.favoritedAt.localeCompare(left.favoritedAt)) : []
}

function saveFavorites(favorites: FavoriteRepository[]) {
  Storage.set(FAVORITES_KEY, favorites)
  for (const listener of listeners) listener()
}

/** 返回切换后的收藏状态。 */
export function toggleFavorite(repository: GitHubRepository): boolean {
  const favorites = readFavorites()
  if (favorites.some(favorite => sameRepository(favorite.fullName, repository.fullName))) {
    saveFavorites(favorites.filter(favorite => !sameRepository(favorite.fullName, repository.fullName)))
    return false
  }
  const { id, name, fullName, description, htmlUrl, language, stargazersCount, forksCount, pushedAt, updatedAt, defaultBranch, owner } = repository
  saveFavorites([{ id, name, fullName, description, htmlUrl, language, stargazersCount, forksCount, pushedAt, starredAt: null, updatedAt, defaultBranch, owner, favoritedAt: new Date().toISOString() }, ...favorites])
  return true
}

/** 任一页面改动收藏后，所有使用此 Hook 的页面同步刷新。 */
export function useFavorites(): FavoriteRepository[] {
  const [favorites, setFavorites] = useState(readFavorites)
  useEffect(() => {
    const listener = () => setFavorites(readFavorites())
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return favorites
}
