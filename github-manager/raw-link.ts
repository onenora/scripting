const URL_TOKEN = /https?:\/\/[^\s<>]+/i

/** Convert one concrete GitHub /blob/ file URL to its raw.githubusercontent.com URL. */
export function rawLinkConversionError(input: string): string {
  const normalized = input.trim().replace(/[\r\n]+/g, "")
  const token = normalized.match(URL_TOKEN)?.[0]?.replace(/[),.;]+$/, "")
  if (!token) return "请输入 GitHub 文件的具体链接。"
  try {
    const url = new URL(token)
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com" && url.hostname !== "raw.githubusercontent.com") {
      return "仅支持 github.com 的文件链接；GitHub Enterprise 或其他自建 GitHub 地址暂不支持。"
    }
  } catch {
    return "链接格式无效，请检查地址后重试。"
  }
  return "请输入具体文件链接，例如 https://github.com/foo/bar/blob/main/path/to/file.json。仓库首页、目录链接和 Pull Request 链接不能转换。"
}

export function githubBlobToRawURL(input: string): string | null {
  const normalized = input.trim().replace(/[\r\n]+/g, "")
  const token = normalized.match(URL_TOKEN)?.[0]?.replace(/[),.;]+$/, "")
  if (!token) return null

  let url: URL
  try {
    url = new URL(token)
  } catch {
    return null
  }

  let segments: string[]
  try {
    segments = url.pathname.split("/").filter(Boolean).map(segment => decodeURIComponent(segment))
  } catch {
    return null
  }
  if (url.hostname === "raw.githubusercontent.com") {
    if (segments.length < 4) return null
    return `https://raw.githubusercontent.com/${segments.map(encodeURIComponent).join("/")}`
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null
  if (segments.length < 5 || segments[2] !== "blob") return null

  const owner = segments[0]
  const repository = segments[1]
  const branch = segments[3]
  const filePath = segments.slice(4)
  if (!owner || !repository || !branch || filePath.length === 0) return null

  return `https://raw.githubusercontent.com/${[owner, repository, branch, ...filePath].map(encodeURIComponent).join("/")}`
}
