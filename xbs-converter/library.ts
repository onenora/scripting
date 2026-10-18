import { Path } from "scripting"
import type { SourceOrigin } from "./source"

export type LibraryEntry = {
  id: string
  name: string
  origin: SourceOrigin
  createdAt: number
  updatedAt: number
  /** 格式化后的 JSON 文本，单独存为 <id>.json。 */
  text: string
}

type StoredEntry = Omit<LibraryEntry, "text">

// App Group 目录不出现在「文件」App 中，只由本脚本读写。
const LIBRARY_DIR = Path.join(FileManager.appGroupDocumentsDirectory, "xbs-converter")
const INDEX_PATH = Path.join(LIBRARY_DIR, "library.json")

function entryPath(id: string): string {
  return Path.join(LIBRARY_DIR, `${id}.json`)
}

function ensureDirectory() {
  if (!FileManager.existsSync(LIBRARY_DIR)) FileManager.createDirectorySync(LIBRARY_DIR, true)
}

function writeIndex(entries: LibraryEntry[]) {
  ensureDirectory()
  const stored: StoredEntry[] = entries.map(({ text: _text, ...meta }) => meta)
  FileManager.writeAsStringSync(INDEX_PATH, JSON.stringify(stored), "utf-8")
}

/** 按更新时间倒序；索引里存在但文件丢失的条目会被跳过。 */
export function loadLibrary(): LibraryEntry[] {
  if (!FileManager.existsSync(INDEX_PATH)) return []
  try {
    const stored = JSON.parse(FileManager.readAsStringSync(INDEX_PATH, "utf-8")) as StoredEntry[]
    return stored
      .filter(meta => FileManager.existsSync(entryPath(meta.id)))
      .map(meta => ({ ...meta, text: FileManager.readAsStringSync(entryPath(meta.id), "utf-8") }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (error) {
    console.warn("无法读取书源库", error)
    return []
  }
}

export function addEntries(entries: LibraryEntry[], items: { name: string; origin: SourceOrigin; text: string }[]): LibraryEntry[] {
  ensureDirectory()
  const now = Date.now()
  const added = items.map((item, index) => ({ ...item, id: UUID.string(), createdAt: now + index, updatedAt: now + index }))
  for (const entry of added) FileManager.writeAsStringSync(entryPath(entry.id), entry.text, "utf-8")
  const next = [...added.reverse(), ...entries]
  writeIndex(next)
  return next
}

export function saveEntry(entries: LibraryEntry[], entry: LibraryEntry): LibraryEntry[] {
  ensureDirectory()
  const updated = { ...entry, updatedAt: Date.now() }
  FileManager.writeAsStringSync(entryPath(updated.id), updated.text, "utf-8")
  // 原位更新：打开中的详情页依赖卡片位置不变。
  const next = entries.map(item => (item.id === entry.id ? updated : item))
  writeIndex(next)
  return next
}

export function removeEntry(entries: LibraryEntry[], id: string): LibraryEntry[] {
  try {
    if (FileManager.existsSync(entryPath(id))) FileManager.removeSync(entryPath(id))
  } catch (error) {
    console.warn("无法删除书源文件", error)
  }
  const next = entries.filter(item => item.id !== id)
  writeIndex(next)
  return next
}
