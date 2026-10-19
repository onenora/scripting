import { fetch, type RequestInit } from "scripting"

// 数据来自第三方站点 scripting.roayc.com，与 Scripting 官方无关。
export const SITE_URL = "https://scripting.roayc.com"

export type StoreScript = {
  id: number
  name: string
  description: string
  /** SF Symbol 名称，优先作为图标。 */
  symbol: string
  /** 图片 URL 或 emoji。 */
  icon: string
  author: string
  url: string
  updateTime: string
  installCount: number
  /** 站点巡检确认资源可访问。 */
  verified: boolean
}

export type SiteNotice = { subtitle: string; warning: string }

export type SubmitData = { name: string; description: string; symbol: string; icon: string; author: string; url: string }

type ApiResponse = { success?: boolean; data?: unknown; message?: string }

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${SITE_URL}${path}`, init)
  if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`)
  const body = (await response.json()) as ApiResponse
  if (!body.success) throw new Error(body.message || "服务器返回失败")
  return body.data
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function toScript(raw: any): StoreScript | null {
  const id = Number(raw?.id)
  const url = text(raw?.url)
  if (!Number.isFinite(id) || id <= 0 || !url) return null
  return {
    id,
    name: text(raw.name) || "未命名脚本",
    description: text(raw.description),
    symbol: text(raw.symbol),
    icon: text(raw.icon),
    author: text(raw.author),
    url,
    updateTime: text(raw.updateTime),
    installCount: Number(raw.installCount) || 0,
    verified: raw.resourceStatus === "VALID",
  }
}

export async function fetchScripts(): Promise<StoreScript[]> {
  const data = await request("/api/plugins")
  if (!Array.isArray(data)) throw new Error("脚本列表格式无效")
  return data.map(toScript).filter((item): item is StoreScript => item !== null)
}

export async function fetchNotice(): Promise<SiteNotice> {
  try {
    const data = (await request("/api/config")) as Record<string, unknown>
    return { subtitle: text(data?.bannerSubtitle), warning: text(data?.warningMessage) }
  } catch {
    return { subtitle: "", warning: "" }
  }
}

export async function submitScript(data: SubmitData): Promise<void> {
  await request("/api/upload/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, symbol: data.symbol || undefined, icon: data.icon || "⭐" }),
  })
}

/** 作者字段形如 `baby, 001` 或 `Ryan (https://github.com/ryanfwy)`。 */
export function authorNames(author: string): string[] {
  return author.replace(/\s*\(https?:\/\/[^)]*\)\s*$/, "").split(/\s*[,，、]\s*/).map(name => name.trim()).filter(Boolean)
}

export function hasAuthor(item: StoreScript, name: string): boolean {
  const target = name.toLowerCase()
  return authorNames(item.author).some(author => author.toLowerCase() === target)
}

/** `2026-08-25 18:56:31` → `2026-08-25` */
export function formatDate(updateTime: string): string {
  return updateTime.slice(0, 10) || "未知"
}

export function hostOf(url: string): string {
  return url.match(/^[a-z]+:\/\/([^/?#]+)/i)?.[1] ?? url
}
