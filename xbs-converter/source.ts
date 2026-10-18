import { Path } from "scripting"
import { jsonToXbsBytes, xbsToJsonBytes } from "./xbs"

export type SourceOrigin = "xbs" | "json" | "text"

export type SourceInfo = {
  alias: string
  name: string
  url: string
  enabled: boolean
  missingActions: string[]
}

/** crash：香色会闪退；error：导入失败或无法解析；hint：建议修改。 */
export type IssueLevel = "crash" | "error" | "hint"

/** fixable：fixSources 能确定地修复（只做类型 / 取值转换，不猜测规则）。 */
export type Issue = { level: IssueLevel; text: string; fixable: boolean }

export type Inspection = {
  /** JSON 解析失败时的错误信息；此时 sources 与 issues 为空。 */
  error: string | null
  sources: SourceInfo[]
  issues: Issue[]
}

// 硬约束来自 onenora/minis-skills xiangse-sources（StandarReader 2.56.1）。
const CORE_ACTIONS = ["searchBook", "bookDetail", "chapterList", "chapterContent"]
const PARSERS = new Set(["DOM", "JS"])
const FORMATS = new Set(["", "base64str", "html", "xml", "json", "data"])
const LEGADO_SOURCE_KEYS = ["bookSourceName", "bookSourceUrl"]
const LEGADO_ACTION_KEYS = ["method", "data", "body", "headers"]
const MINI_APP_VERSION = "2.56.1"

type JSONObject = Record<string, unknown>

const crash = (text: string, fixable = false): Issue => ({ level: "crash", text, fixable })
const error = (text: string, fixable = false): Issue => ({ level: "error", text, fixable })
const hint = (text: string, fixable = false): Issue => ({ level: "hint", text, fixable })

function isObject(value: unknown): value is JSONObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function singleAlias(source: JSONObject): string {
  return typeof source.sourceName === "string" && source.sourceName ? source.sourceName : "source"
}

function isEnabled(value: unknown): boolean {
  return !(value === 0 || value === false || value === "0")
}

export function utf8Bytes(text: string): Uint8Array {
  const bytes = Data.fromString(text, "utf-8")?.toUint8Array()
  if (!bytes) throw new Error("无法编码为 UTF-8。")
  return bytes
}

export function utf8Text(bytes: Uint8Array): string {
  const data = Data.fromUint8Array(bytes)
  if (!data) throw new Error("无法读取文本。")
  return data.toDecodedString("utf8")
}

/** 合法 JSON 统一为 2 空格缩进，非法时原样返回。 */
export function prettyJSON(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function parseSources(text: string): JSONObject {
  const value = JSON.parse(text)
  if (!isObject(value)) throw new Error("顶层必须是「别名 → 书源」对象。")
  return value
}

export function decodeXBS(bytes: Uint8Array): string {
  const text = utf8Text(xbsToJsonBytes(bytes))
  try {
    JSON.parse(text)
  } catch {
    throw new Error("解密结果不是有效 JSON，文件可能不是香色书源。")
  }
  return text
}

/** 压缩 JSON 后加密，并解密回读逐字节比对。设置了密码时写入每个书源的 password 字段。 */
export function encodeXBS(text: string, password = ""): Data {
  const value = JSON.parse(text)
  if (password && isObject(value)) {
    for (const source of Object.values(value)) {
      if (isObject(source)) source.password = password
    }
  }
  const json = utf8Bytes(JSON.stringify(value))
  const xbs = jsonToXbsBytes(json)
  const back = xbsToJsonBytes(xbs)
  if (back.length !== json.length || back.some((byte, index) => byte !== json[index])) {
    throw new Error("往返校验失败，未生成文件。")
  }
  const data = Data.fromUint8Array(xbs)
  if (!data) throw new Error("无法生成 XBS 数据。")
  return data
}

/** 按扩展名与内容识别 XBS / JSON；非法 JSON 也导入，便于在编辑器里修复。 */
export async function readSourceFile(path: string): Promise<{ name: string; origin: SourceOrigin; text: string }> {
  const ext = Path.extname(path).toLowerCase()
  const name = Path.basename(path, Path.extname(path)) || "未命名书源"
  const bytes = (await FileManager.readAsData(path)).toUint8Array()
  if (!bytes?.length) throw new Error("文件为空。")
  if (ext === ".xbs") return { name, origin: "xbs", text: prettyJSON(decodeXBS(bytes)) }

  const text = utf8Text(bytes)
  if (ext === ".json") return { name, origin: "json", text: prettyJSON(text) }
  try {
    JSON.parse(text)
    return { name, origin: "json", text: prettyJSON(text) }
  } catch {
    return { name, origin: "xbs", text: prettyJSON(decodeXBS(bytes)) }
  }
}

function inspectAction(prefix: string, key: string, action: unknown, issues: Issue[]) {
  if (!isObject(action)) {
    issues.push(error(`${prefix}${key} 不是对象`))
    return
  }
  if (action.actionID !== key) issues.push(error(`${prefix}${key}.actionID 应为 "${key}"`, true))
  if (!PARSERS.has(String(action.parserID))) {
    issues.push(error(`${prefix}${key}.parserID 只能是 DOM 或 JS`, fixedParserID(action.parserID) !== undefined))
  }
  if (typeof action.requestInfo !== "string") {
    issues.push(error(`${prefix}${key}.requestInfo 必须是字符串`, fixedRequestInfo(key, action.requestInfo) !== undefined))
  }
  if (action.responseFormatType === "text") issues.push(error(`${prefix}${key}.responseFormatType 禁用 "text"，请改为 ""`, true))
  else if (typeof action.responseFormatType !== "string" || !FORMATS.has(action.responseFormatType)) {
    issues.push(error(`${prefix}${key}.responseFormatType 只能是 ""、base64str、html、xml、json、data`, fixedFormat(action.responseFormatType) !== undefined))
  }
  for (const legacy of LEGADO_ACTION_KEYS) {
    if (legacy in action) issues.push(error(`${prefix}${key} 含 Legado 字段 ${legacy}`))
  }
}

function inspectBookWorld(prefix: string, bookWorld: unknown, issues: Issue[]) {
  if (Array.isArray(bookWorld) || !isObject(bookWorld)) {
    issues.push(crash(`${prefix}bookWorld 必须是分类字典（数组会闪退）`))
    return
  }
  if (Array.isArray(bookWorld.categories)) issues.push(crash(`${prefix}bookWorld 禁用 categories 数组（会闪退）`))
  for (const [category, value] of Object.entries(bookWorld)) {
    const filters = isObject(value) && isObject(value.moreKeys) ? value.moreKeys.requestFilters : undefined
    if (filters !== undefined && typeof filters !== "string") {
      issues.push(error(`${prefix}bookWorld.${category}.moreKeys.requestFilters 必须是字符串`))
    }
  }
}

export function inspectSources(text: string): Inspection {
  let root: JSONObject
  try {
    root = parseSources(text)
  } catch (parseError) {
    return { error: parseError instanceof Error ? parseError.message : String(parseError), sources: [], issues: [] }
  }

  const sources: SourceInfo[] = []
  const issues: Issue[] = []
  if ("sourceName" in root) {
    issues.push(error("顶层像是单个书源，应包一层「别名 → 书源」", true))
    root = { [singleAlias(root)]: root }
  }
  if (text.includes("java.getParams")) issues.push(error("含 Legado 调用 java.getParams"))

  for (const [alias, source] of Object.entries(root)) {
    const prefix = `${alias}：`
    if (!isObject(source)) {
      issues.push(error(`${prefix}不是书源对象`))
      continue
    }
    const missingActions = CORE_ACTIONS.filter(key => !(key in source))
    sources.push({
      alias,
      name: typeof source.sourceName === "string" && source.sourceName ? source.sourceName : alias,
      url: typeof source.sourceUrl === "string" ? source.sourceUrl : "",
      enabled: isEnabled(source.enable),
      missingActions,
    })

    if (typeof source.sourceName !== "string" || !source.sourceName) issues.push(error(`${prefix}缺少 sourceName`))
    if (typeof source.sourceUrl !== "string" || !source.sourceUrl) issues.push(error(`${prefix}缺少 sourceUrl`))
    if (source.sourceType !== "text") {
      const fixable = fixedSourceType(source.sourceType) !== undefined
      issues.push(error(fixable ? `${prefix}sourceType 应为 "text"` : `${prefix}sourceType 为 ${JSON.stringify(source.sourceType)}，只支持文本书源 "text"`, fixable))
    }
    if (typeof source.weight === "number") issues.push(crash(`${prefix}weight 必须是字符串（数字会闪退）`, true))
    if (!source.miniAppVersion) issues.push(hint(`${prefix}缺少 miniAppVersion（建议 "${MINI_APP_VERSION}"）`, true))
    for (const legacy of LEGADO_SOURCE_KEYS) {
      if (legacy in source) issues.push(error(`${prefix}含 Legado 字段 ${legacy}`))
    }
    if (missingActions.length) issues.push(error(`${prefix}缺少 ${missingActions.join("、")}`))
    for (const key of CORE_ACTIONS) {
      if (key in source) inspectAction(prefix, key, source[key], issues)
    }
    if ("bookWorld" in source) inspectBookWorld(prefix, source.bookWorld, issues)
  }
  if (!sources.length && !issues.length) issues.push(error("没有书源"))
  return { error: null, sources, issues }
}

// 自动修复只做确定的类型 / 取值转换；返回 undefined 表示无需或无法修复。

function fixedRequestInfo(key: string, value: unknown): string | undefined {
  if (typeof value === "string") return undefined
  // 缺省时详情、目录、正文沿用上一步结果；搜索必须有请求地址，无法推断。
  if (value === undefined || value === null) return key === "searchBook" ? undefined : "%@result"
  // 请求对象改写为等价的 JS 式：@js: 返回同一个对象。
  if (typeof value === "object") return `@js:\nreturn ${JSON.stringify(value)};`
  return String(value)
}

function fixedParserID(value: unknown): string | undefined {
  if (PARSERS.has(String(value))) return undefined
  const upper = typeof value === "string" ? value.trim().toUpperCase() : ""
  return PARSERS.has(upper) ? upper : undefined
}

function fixedFormat(value: unknown): string | undefined {
  if (typeof value === "string" && FORMATS.has(value)) return undefined
  if (value === undefined || value === null || value === "text") return ""
  const lower = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (lower === "text") return ""
  return FORMATS.has(lower) ? lower : undefined
}

function fixedSourceType(value: unknown): string | undefined {
  if (value === "text") return undefined
  if (typeof value !== "string" || !value.trim() || value.trim().toLowerCase() === "text") return "text"
  return undefined
}

function fixAction(key: string, action: JSONObject): number {
  let fixed = 0
  const set = (field: string, value: string | undefined) => {
    if (value === undefined) return
    action[field] = value
    fixed += 1
  }
  set("actionID", action.actionID === key ? undefined : key)
  set("parserID", fixedParserID(action.parserID))
  set("requestInfo", fixedRequestInfo(key, action.requestInfo))
  set("responseFormatType", fixedFormat(action.responseFormatType))
  return fixed
}

/** 修复所有 fixable 提示，返回新文本与修复数量；无可修复项时原样返回。 */
export function fixSources(text: string): { text: string; fixed: number } {
  let root = parseSources(text)
  let fixed = 0
  if ("sourceName" in root) {
    root = { [singleAlias(root)]: root }
    fixed += 1
  }
  for (const source of Object.values(root)) {
    if (!isObject(source)) continue
    const sourceType = fixedSourceType(source.sourceType)
    if (sourceType !== undefined) {
      source.sourceType = sourceType
      fixed += 1
    }
    if (typeof source.weight === "number") {
      source.weight = String(source.weight)
      fixed += 1
    }
    if (!source.miniAppVersion) {
      source.miniAppVersion = MINI_APP_VERSION
      fixed += 1
    }
    for (const key of CORE_ACTIONS) {
      const action = source[key]
      if (isObject(action)) fixed += fixAction(key, action)
    }
  }
  return { text: fixed ? JSON.stringify(root, null, 2) : text, fixed }
}

/** 修改单个书源后重新格式化整份 JSON。 */
export function updateSources(text: string, change: (root: JSONObject) => void): string {
  const root = parseSources(text)
  change(root)
  return JSON.stringify(root, null, 2)
}

export function setSourceEnabled(text: string, alias: string, enabled: boolean): string {
  return updateSources(text, root => {
    const source = root[alias]
    if (isObject(source)) source.enable = enabled ? 1 : 0
  })
}

export function removeSource(text: string, alias: string): string {
  return updateSources(text, root => {
    delete root[alias]
  })
}

export function sourceJSON(text: string, alias: string): string {
  return JSON.stringify({ [alias]: parseSources(text)[alias] }, null, 2)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
