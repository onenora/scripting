import { useEffect, useState } from "scripting"

const FAVORITES_KEY = "script-store.favorites"
const AUTHOR_KEY = "script-store.author"

const listeners = new Set<() => void>()

/** 收藏的脚本 ID，最近收藏在前。 */
export function readFavorites(): number[] {
  const saved = Storage.get<number[]>(FAVORITES_KEY)
  return Array.isArray(saved) ? saved.filter(id => typeof id === "number") : []
}

/** 返回切换后的收藏状态。 */
export function toggleFavorite(id: number): boolean {
  const favorites = readFavorites()
  const next = favorites.includes(id) ? favorites.filter(item => item !== id) : [id, ...favorites]
  Storage.set(FAVORITES_KEY, next)
  for (const listener of listeners) listener()
  return next.includes(id)
}

/** 任一页面改动收藏后，所有使用此 Hook 的页面同步刷新。 */
export function useFavorites(): number[] {
  const [favorites, setFavorites] = useState(readFavorites)
  useEffect(() => {
    const listener = () => setFavorites(readFavorites())
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return favorites
}

/** 发布时记住的作者名。 */
export function readAuthor(): string {
  return Storage.get<string>(AUTHOR_KEY) ?? ""
}

export function saveAuthor(author: string) {
  Storage.set(AUTHOR_KEY, author)
}
