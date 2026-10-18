import { fetch } from "scripting"
import type { AccessMode, TokenInfo, GitHubActionsRun, GitHubActionsStatus, GitHubBranch, GitHubCommit, GitHubContentItem, GitHubOwnedRepository, GitHubOwnerProfile, GitHubPullRequest, GitHubPullRequestFile, GitHubRelease, GitHubReleaseAsset, GitHubRepository } from "./types"

const TOKEN_KEY = "github-star.access-token"
const USERNAME_KEY = "github-star.username"
const TOKEN_INFO_KEY = "github-star.token-info"
const API_ROOT = "https://api.github.com"
const API_URL = `${API_ROOT}/user/starred`
const REQUEST_TIMEOUT_MS = 20_000

type GitHubApiUser = {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
}

type GitHubApiOwner = GitHubApiUser & {
  type: string
  bio: string | null
  company: string | null
  blog: string | null
  location: string | null
  followers: number
  following: number
  public_repos: number
  created_at: string
}

type GitHubApiRepository = {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  language: string | null
  stargazers_count: number
  forks_count: number
  pushed_at: string | null
  updated_at: string
  default_branch?: string
  owner: {
    login: string
    avatar_url: string
  }
  starred_at?: string | null
}

type GitHubApiStarredRepository = GitHubApiRepository & {
  starred_at: string | null
}

type GitHubError = {
  message?: string
}

export class GitHubRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "GitHubRequestError"
    this.status = status
  }
}

type GitHubApiBranch = {
  name: string
  protected: boolean
  commit: { sha: string }
}

type GitHubApiContent = {
  name: string
  path: string
  sha: string
  size: number
  type: GitHubContentItem["type"]
  html_url: string
  download_url: string | null
  content?: string
  encoding?: string
}

type GitHubApiWorkflowRun = {
  id: number
  run_number: number
  name: string | null
  event: string
  head_branch: string | null
  status: string | null
  conclusion: string | null
  updated_at: string | null
  html_url: string
}

type GitHubApiPullRequest = {
  number: number
  title: string
  body: string | null
  html_url: string
  state: "open" | "closed"
  draft: boolean
  head: { ref: string }
  base: { ref: string }
  user: { login: string } | null
  created_at: string
  updated_at: string
}

type GitHubApiPullRequestFile = {
  filename: string
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "changed"
  additions: number
  deletions: number
  changes: number
}

type GitHubApiCommit = {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      name: string
      date: string | null
    } | null
  }
}

type GitHubApiReleaseAsset = {
  id: number
  name: string
  size: number
  content_type: string
  download_count: number
  url: string
}

type GitHubApiRelease = {
  id: number
  tag_name: string
  name: string | null
  body: string | null
  draft: boolean
  prerelease: boolean
  published_at: string | null
  created_at: string
  html_url: string
  assets: GitHubApiReleaseAsset[]
}

type GitHubApiOwnedRepository = GitHubApiRepository & {
  private: boolean
  fork: boolean
  parent?: { full_name: string }
  size: number
  open_issues_count: number
  default_branch: string
}

function authHeaders(accept = "application/vnd.github+json", requireAuth = false): Record<string, string> {
  const token = activeToken()
  if (!token && requireAuth) throw new Error("请先在设置中保存 GitHub Personal Access Token。")
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/** 应用只读：所有请求均为 GET。 */
type RequestOptions = {
  headers?: Record<string, string>
  requireAuth?: boolean
  onHeaders?: (headers: ResponseHeaders) => void
}

type ResponseHeaders = { get: (name: string) => string | null }

type GitHubHTTPResponse = {
  ok: boolean
  status: number
  headers: ResponseHeaders
  json: () => Promise<unknown>
}

async function requestJSON<T>(url: string, requestOptions: RequestOptions = {}): Promise<T> {
  const { onHeaders, ...options } = requestOptions
  const requireAuth = options.requireAuth ?? false
  let response: GitHubHTTPResponse
  try {
    response = await Promise.race([
      fetch(url, {
        method: "GET",
        headers: {
          ...authHeaders(options.headers?.Accept ?? "application/vnd.github+json", requireAuth),
          ...(options.headers ?? {}),
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("请求超时")), REQUEST_TIMEOUT_MS)
      }),
    ]) as GitHubHTTPResponse
  } catch (caught) {
    const message = caught instanceof Error && caught.message === "请求超时"
      ? "请求超时，请检查网络后重试。"
      : caught instanceof Error
        ? `网络请求失败：${caught.message}`
        : "网络请求失败，请检查网络连接后重试。"
    throw new GitHubRequestError(message, 0)
  }
  onHeaders?.(response.headers)
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as GitHubError
    if (response.status === 401) throw new GitHubRequestError("Token 无效或已过期，请在设置中更新。", response.status)
    if (response.status === 403) throw new GitHubRequestError(payload.message?.toLowerCase().includes("rate limit") ? "GitHub API 请求次数已达上限（公共浏览每小时 60 次）。可在设置中添加 Token，限额提升至 5000 次/小时。" : (payload.message ?? "GitHub 拒绝了请求，请检查权限。"), response.status)
    if (response.status === 404) throw new GitHubRequestError("GitHub 找不到请求的仓库、用户、分支或文件。", response.status)
    throw new GitHubRequestError(payload.message ?? `GitHub 请求失败（${response.status}），请稍后重试。`, response.status)
  }
  return (await response.json()) as T
}

function mapRepository(repository: GitHubApiRepository): GitHubRepository {
  return {
    id: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    description: repository.description,
    htmlUrl: repository.html_url,
    language: repository.language,
    stargazersCount: repository.stargazers_count,
    forksCount: repository.forks_count,
    pushedAt: repository.pushed_at,
    starredAt: repository.starred_at ?? null,
    updatedAt: repository.updated_at,
    defaultBranch: repository.default_branch,
    owner: {
      login: repository.owner.login,
      avatarUrl: `${repository.owner.avatar_url}${repository.owner.avatar_url.includes("?") ? "&" : "?"}s=96`,
    },
  }
}

const TOKEN_PAUSED_KEY = "github-star.token-paused"

function storedToken(): string | null {
  return Keychain.get(TOKEN_KEY)?.trim() || null
}

/** 退出授权只暂停使用，Token 仍留在钥匙串；暂停期间所有请求按公共浏览发送。 */
function activeToken(): string | null {
  return Storage.get<boolean>(TOKEN_PAUSED_KEY) === true ? null : storedToken()
}

/** 当前是否以 Token 授权浏览（已保存且未暂停）。 */
export function hasGitHubToken(): boolean {
  return activeToken() !== null
}

/** 钥匙串中是否保存了 Token（含已暂停）。 */
export function hasStoredGitHubToken(): boolean {
  return storedToken() !== null
}

export function pauseGitHubToken(): void {
  Storage.set(TOKEN_PAUSED_KEY, true)
}

export function resumeGitHubToken(): void {
  Storage.remove(TOKEN_PAUSED_KEY)
}

function tokenKind(token: string): TokenInfo["kind"] {
  if (token.startsWith("github_pat_")) return "fine-grained"
  if (token.startsWith("ghp_")) return "classic"
  return "other"
}

/** 仅此设备、不同步 iCloud；优先要求设备密码，未设置设备密码时退回解锁后可读。 */
function writeTokenToKeychain(token: string): TokenInfo["storage"] | null {
  Keychain.remove(TOKEN_KEY)
  for (const accessibility of ["passcode", "unlocked_this_device"] as const) {
    if (Keychain.set(TOKEN_KEY, token, { accessibility, synchronizable: false })) return accessibility
  }
  return null
}

export function saveGitHubToken(token: string): boolean {
  const value = token.trim()
  const storage = writeTokenToKeychain(value)
  if (!storage) return false
  resumeGitHubToken()
  saveTokenInfo({ kind: tokenKind(value), suffix: value.slice(-4), storage, expiresAt: null, verifiedAt: null })
  return true
}

export function removeGitHubToken(): boolean {
  Storage.remove(TOKEN_INFO_KEY)
  Storage.remove(TOKEN_PAUSED_KEY)
  return Keychain.remove(TOKEN_KEY)
}

/** 已保存 Token 的元数据（含已暂停）。 */
export function readTokenInfo(): TokenInfo | null {
  if (!hasStoredGitHubToken()) return null
  const stored = Storage.get<TokenInfo>(TOKEN_INFO_KEY)
  if (stored) return stored
  // 2.6.0 之前保存的 Token 没有元数据，保护等级为解锁后可读。
  const token = Keychain.get(TOKEN_KEY)?.trim() ?? ""
  const legacy: TokenInfo = { kind: tokenKind(token), suffix: token.slice(-4), storage: "unlocked_this_device", expiresAt: null, verifiedAt: null }
  saveTokenInfo(legacy)
  return legacy
}

function saveTokenInfo(info: TokenInfo): void {
  Storage.set(TOKEN_INFO_KEY, info)
}

/** 旧 Token 重新写入钥匙串，升级为需设备密码保护。返回更新后的元数据。 */
export function upgradeTokenProtection(): TokenInfo | null {
  const token = storedToken()
  const info = readTokenInfo()
  if (!token || !info) return null
  const storage = writeTokenToKeychain(token)
  if (!storage) return null
  const updated: TokenInfo = { ...info, storage }
  saveTokenInfo(updated)
  return updated
}

function parseTokenExpiration(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value.replace(" UTC", "Z").replace(" ", "T"))
  return isNaN(date.getTime()) ? null : date.toISOString()
}

/** 验证 Token 并从响应头记录过期时间。 */
function mapOwnerProfile(owner: GitHubApiOwner): GitHubOwnerProfile {
  return {
    login: owner.login,
    name: owner.name,
    avatarUrl: owner.avatar_url,
    htmlUrl: owner.html_url,
    type: owner.type,
    bio: owner.bio,
    company: owner.company,
    blog: owner.blog,
    location: owner.location,
    followers: owner.followers,
    following: owner.following,
    publicRepos: owner.public_repos,
    createdAt: owner.created_at,
  }
}

async function verifyGitHubToken(): Promise<GitHubOwnerProfile> {
  let expiration: string | null = null
  const user = await requestJSON<GitHubApiOwner>(`${API_ROOT}/user`, {
    requireAuth: true,
    onHeaders: headers => { expiration = headers.get("github-authentication-token-expiration") },
  })
  const info = readTokenInfo()
  if (info) saveTokenInfo({ ...info, expiresAt: parseTokenExpiration(expiration), verifiedAt: new Date().toISOString(), login: user.login })
  return mapOwnerProfile(user)
}

export function getGitHubUsername(): string | null {
  return Storage.get<string>(USERNAME_KEY)?.trim() || null
}

export function saveGitHubUsername(username: string): boolean {
  return Storage.set(USERNAME_KEY, username.trim())
}

export function removeGitHubUsername(): void {
  Storage.remove(USERNAME_KEY)
}

/** 授权浏览且浏览对象是 Token 所属账户本人。 */
export function isBrowsingTokenOwner(): boolean {
  if (!hasGitHubToken()) return false
  const username = getGitHubUsername()
  return !username || username.toLowerCase() === readTokenInfo()?.login?.toLowerCase()
}

/** 有可用 Token 即为授权浏览（只影响限额与私有仓库）；浏览对象由用户名决定，未设置时为 Token 所属账户。 */
export function readAccessMode(): AccessMode {
  if (hasGitHubToken()) return "token"
  return getGitHubUsername() ? "public" : "none"
}

const PUBLIC_CACHE_INDEX_KEY = "github-star.public-cache-index"
const PUBLIC_CACHE_PREFIX = "github-star.public-cache."
const PUBLIC_CACHE_LIMIT = 300
const HOUR_MS = 60 * 60_000
const REPOSITORY_CACHE_TTL = 12 * HOUR_MS
const SEARCH_CACHE_TTL = HOUR_MS / 2
const USER_CACHE_TTL = 24 * HOUR_MS

type PublicCacheEntry<T> = { key: string; at: number; value: T }
type PublicCacheIndex = Record<string, { key: string; at: number }>

function publicCacheStorageKey(key: string): string {
  let hash = 5381
  for (let index = 0; index < key.length; index += 1) hash = ((hash << 5) + hash + key.charCodeAt(index)) | 0
  return `${PUBLIC_CACHE_PREFIX}${(hash >>> 0).toString(36)}`
}

function readPublicCache<T>(key: string, ttl: number): PublicCacheEntry<T> | null {
  if (hasGitHubToken()) return null
  const entry = Storage.get<PublicCacheEntry<T>>(publicCacheStorageKey(key))
  return entry && entry.key === key && Date.now() - entry.at < ttl ? entry : null
}

function writePublicCache<T>(key: string, value: T): void {
  const storageKey = publicCacheStorageKey(key)
  const at = Date.now()
  Storage.set(storageKey, { key, at, value } satisfies PublicCacheEntry<T>)
  const index = Storage.get<PublicCacheIndex>(PUBLIC_CACHE_INDEX_KEY) ?? {}
  index[storageKey] = { key, at }
  for (const [expiredKey] of Object.entries(index).sort((left, right) => right[1].at - left[1].at).slice(PUBLIC_CACHE_LIMIT)) {
    Storage.remove(expiredKey)
    delete index[expiredKey]
  }
  Storage.set(PUBLIC_CACHE_INDEX_KEY, index)
}

/** 公共浏览（无 Token，每小时 60 次）下 GET 结果持久化缓存：命中即不发请求；授权浏览始终直连。 */
async function withPublicCache<T>(key: string, ttl: number, fetcher: () => Promise<T>, fresh = false): Promise<T> {
  if (hasGitHubToken()) return fetcher()
  const cached = fresh ? null : readPublicCache<T>(key, ttl)
  if (cached) return cached.value
  const value = await fetcher()
  writePublicCache(key, value)
  return value
}

function repositoryCacheKey(owner: string, repository: string): string {
  return `repo:${owner.toLowerCase()}/${repository.toLowerCase()}:`
}

/** 下拉刷新等手动操作调用：清除该仓库的公共缓存，下次读取重新请求 GitHub。 */
export function invalidateRepositoryCache(fullName: string): void {
  const [owner = "", repository = ""] = fullName.split("/")
  invalidatePublicCache(repositoryCacheKey(owner, repository))
}

export function invalidatePublicCache(prefix = ""): void {
  const index = Storage.get<PublicCacheIndex>(PUBLIC_CACHE_INDEX_KEY) ?? {}
  for (const [storageKey, entry] of Object.entries(index)) {
    if (!entry.key.startsWith(prefix)) continue
    Storage.remove(storageKey)
    delete index[storageKey]
  }
  Storage.set(PUBLIC_CACHE_INDEX_KEY, index)
}

// 3.0.1 之前只缓存当前身份，迁移到按用户保存的快照后移除。
const LEGACY_STARS_CACHE_KEY = "github-star.cached-stars"
const LEGACY_STARS_SYNCED_AT_KEY = "github-star.synced-at"
const LEGACY_STARS_NEXT_PAGE_KEY = "github-star.stars-next-page"
const LEGACY_ACCOUNT_CACHE_KEY = "github-star.cached-account"
const USER_SNAPSHOT_PREFIX = "github-star.user-snapshot."
const BROWSE_HISTORY_KEY = "github-star.browse-history"
const BROWSE_HISTORY_LIMIT = 30

/** 每个浏览用户各自的资料与 Star 缓存，切换回来时直接显示、不发请求。 */
export type UserSnapshot = {
  account?: GitHubOwnerProfile
  stars?: GitHubRepository[]
  nextPage?: number | null
  syncedAt?: string | null
}

export type BrowseHistoryEntry = { login: string; viewedAt: string }

/** 当前浏览对象：用户名优先，否则为 Token 所属账户；Token 未验证前暂记为 @self。 */
export function currentBrowseIdentity(): string | null {
  const username = getGitHubUsername()
  if (username) return username.toLowerCase()
  if (!hasGitHubToken()) return null
  return readTokenInfo()?.login?.toLowerCase() ?? "@self"
}

function snapshotKey(identity: string): string {
  return `${USER_SNAPSHOT_PREFIX}${identity.toLowerCase()}`
}

export function readUserSnapshot(login: string): UserSnapshot {
  return Storage.get<UserSnapshot>(snapshotKey(login)) ?? {}
}

function readCurrentSnapshot(): UserSnapshot {
  const identity = currentBrowseIdentity()
  return identity ? readUserSnapshot(identity) : {}
}

function updateCurrentSnapshot(patch: UserSnapshot): boolean {
  const identity = currentBrowseIdentity()
  if (!identity) return false
  return Storage.set(snapshotKey(identity), { ...readUserSnapshot(identity), ...patch })
}

export function readCachedStars(): GitHubRepository[] {
  return readCurrentSnapshot().stars ?? []
}

export function saveCachedStars(repos: GitHubRepository[]): boolean {
  return updateCurrentSnapshot({ stars: repos })
}

export function readStarsSyncedAt(): string | null {
  return readCurrentSnapshot().syncedAt ?? null
}

export function saveStarsSyncedAt(iso: string | null): boolean {
  return updateCurrentSnapshot({ syncedAt: iso })
}

/** 已缓存 Star 的下一页页码；null 表示已全部加载。 */
export function readStarsNextPage(): number | null {
  const saved = readCurrentSnapshot().nextPage
  return typeof saved === "number" ? saved : null
}

export function saveStarsNextPage(page: number | null): boolean {
  return updateCurrentSnapshot({ nextPage: page })
}

/** 旧版缓存只有基本身份字段，视为无缓存，下次刷新时补全资料。 */
export function readCachedAccount(): GitHubOwnerProfile | null {
  const saved = readCurrentSnapshot().account
  return saved && typeof saved.createdAt === "string" ? saved : null
}

export function saveCachedAccount(account: GitHubOwnerProfile): boolean {
  return updateCurrentSnapshot({ account })
}

/** 把旧版单身份缓存迁入当前浏览对象的快照。 */
export function migrateLegacyStarsCache(): void {
  const stars = Storage.get<GitHubRepository[]>(LEGACY_STARS_CACHE_KEY)
  const account = Storage.get<GitHubOwnerProfile>(LEGACY_ACCOUNT_CACHE_KEY)
  if (!stars && !account) return
  if (currentBrowseIdentity() && readCachedStars().length === 0) {
    const nextPage = Storage.get<unknown>(LEGACY_STARS_NEXT_PAGE_KEY)
    updateCurrentSnapshot({
      stars: stars ?? [],
      syncedAt: Storage.get<string>(LEGACY_STARS_SYNCED_AT_KEY),
      nextPage: typeof nextPage === "number" ? nextPage : null,
      ...(account ? { account } : {}),
    })
    const username = getGitHubUsername()
    if (username) recordBrowseUser(username)
  }
  for (const key of [LEGACY_STARS_CACHE_KEY, LEGACY_STARS_SYNCED_AT_KEY, LEGACY_STARS_NEXT_PAGE_KEY, LEGACY_ACCOUNT_CACHE_KEY]) Storage.remove(key)
}

/** 切换过的用户，最近浏览在前。 */
export function readBrowseHistory(): BrowseHistoryEntry[] {
  return Storage.get<BrowseHistoryEntry[]>(BROWSE_HISTORY_KEY) ?? []
}

export function recordBrowseUser(login: string): void {
  const history = readBrowseHistory().filter(entry => entry.login.toLowerCase() !== login.toLowerCase())
  const next = [{ login, viewedAt: new Date().toISOString() }, ...history]
  // 超出上限的旧记录连同快照一起清除。
  for (const dropped of next.slice(BROWSE_HISTORY_LIMIT)) Storage.remove(snapshotKey(dropped.login))
  Storage.set(BROWSE_HISTORY_KEY, next.slice(0, BROWSE_HISTORY_LIMIT))
}

/** 删除浏览记录及该用户的资料与 Star 缓存。 */
export function removeBrowseUser(login: string): void {
  Storage.set(BROWSE_HISTORY_KEY, readBrowseHistory().filter(entry => entry.login.toLowerCase() !== login.toLowerCase()))
  Storage.remove(snapshotKey(login))
}

/** 每次请求 100 个（与 20 个同样只消耗 1 次额度），界面按 20 个分批渲染，用完再请求下一页。 */
export const STARS_PAGE_SIZE = 100

/** 按 Star 时间倒序分页读取；nextPage 为 null 表示已全部加载。 */
export async function fetchStarredRepositoriesPage(page: number): Promise<{ repositories: GitHubRepository[]; nextPage: number | null }> {
  const token = activeToken()
  const username = getGitHubUsername()?.trim()

  if (!token && !username) {
    throw new Error("请先在设置中填写 GitHub 用户名或添加 Token。")
  }

  // 浏览他人时同样带 Token，只为放宽限额。
  const endpoint = token && isBrowsingTokenOwner()
    ? API_URL
    : `${API_ROOT}/users/${encodeURIComponent(username!)}/starred`

  const batch = await requestJSON<any[]>(`${endpoint}?per_page=${STARS_PAGE_SIZE}&page=${page}`, {
    headers: { Accept: "application/vnd.github.star+json, application/vnd.github+json" },
    requireAuth: endpoint === API_URL,
  })
  const items: GitHubApiStarredRepository[] = Array.isArray(batch)
    ? batch.map((item: any) => ({ ...(item.repo ?? item), starred_at: item.starred_at ?? null }))
    : []
  return {
    repositories: items.map(mapRepository),
    nextPage: items.length < STARS_PAGE_SIZE ? null : page + 1,
  }
}

function searchQualifier(query: string): string {
  const search = query.trim()
  const fullNameMatch = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+)$/.exec(search)
  const hasQualifier = /(?:^|\s)[\w-]+:(?:[^\s]+)/.test(search)
  const q = !search
    ? "stars:>1000 fork:false"
    : fullNameMatch
      ? `repo:${fullNameMatch[1]}/${fullNameMatch[2]}`
      : hasQualifier
        ? search
        : `${search} in:name,description fork:false`
  return q
}

/** 仅读取公共缓存，不发请求；未命中返回 null。 */
export function readCachedSearchRepositories(query = ""): GitHubRepository[] | null {
  return readPublicCache<GitHubRepository[]>(`search:${searchQualifier(query)}`, SEARCH_CACHE_TTL)?.value ?? null
}

export async function searchRepositories(query = "", fresh = false): Promise<GitHubRepository[]> {
  const q = searchQualifier(query)
  return withPublicCache(`search:${q}`, SEARCH_CACHE_TTL, async () => {
    const payload = await requestJSON<{ items: GitHubApiRepository[] }>(`${API_ROOT}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`)
    return payload.items.map(mapRepository)
  }, fresh)
}

/** 作者主页资料：用户或组织均走 /users/{login}。 */
export async function fetchOwnerProfile(login: string, fresh = false): Promise<GitHubOwnerProfile> {
  return withPublicCache(`owner:${login.toLowerCase()}`, USER_CACHE_TTL, async () => {
    return mapOwnerProfile(await requestJSON<GitHubApiOwner>(`${API_ROOT}/users/${encodeURIComponent(login)}`))
  }, fresh)
}

/** 作者的公开仓库，按最近推送排序，取前 100 个。 */
export async function fetchOwnerRepositories(login: string, fresh = false): Promise<GitHubRepository[]> {
  return withPublicCache(`owner-repos:${login.toLowerCase()}`, REPOSITORY_CACHE_TTL, async () => {
    const payload = await requestJSON<GitHubApiRepository[]>(`${API_ROOT}/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&per_page=100`)
    return payload.map(mapRepository)
  }, fresh)
}

/** Token 所属账户自己的仓库（含私有），仅授权浏览可用。 */
export async function fetchOwnedRepositories(): Promise<GitHubOwnedRepository[]> {
  const repositories: GitHubOwnedRepository[] = []
  for (let page = 1; ; page += 1) {
    const batch = await requestJSON<GitHubApiOwnedRepository[]>(`${API_ROOT}/user/repos?visibility=all&affiliation=owner&sort=updated&per_page=100&page=${page}`, {
      requireAuth: true,
    })
    repositories.push(...batch.map(repository => ({
      ...mapRepository(repository),
      defaultBranch: repository.default_branch ?? "main",
      private: repository.private ?? false,
      fork: repository.fork ?? false,
      upstreamFullName: repository.parent?.full_name ?? null,
      size: repository.size ?? 0,
      openIssuesCount: repository.open_issues_count ?? 0,
    })))
    if (batch.length < 100) return repositories
  }
}

function mapActionsRun(run: GitHubApiWorkflowRun): GitHubActionsRun {
  return { id: run.id, runNumber: run.run_number, workflowName: run.name ?? "未命名工作流", event: run.event, branch: run.head_branch, status: run.status ?? "unknown", conclusion: run.conclusion, updatedAt: run.updated_at, htmlUrl: run.html_url }
}

export async function fetchRepositoryActionsRuns(owner: string, repository: string, branch?: string): Promise<GitHubActionsRun[]> {
  const params = new URLSearchParams({ per_page: "30" })
  if (branch) params.set("branch", branch)
  const payload = await requestJSON<{ workflow_runs: GitHubApiWorkflowRun[] }>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/runs?${params.toString()}`)
  return payload.workflow_runs.map(mapActionsRun)
}

/** 浏览对象的完整资料。授权浏览先验证 Token；用户名就是本人时清除，统一按「本人」处理。 */
export async function fetchCurrentGitHubAccount(): Promise<GitHubOwnerProfile> {
  const token = activeToken()
  const username = getGitHubUsername()?.trim()

  if (token) {
    const owner = await verifyGitHubToken()
    if (!username) return owner
    if (username.toLowerCase() === owner.login.toLowerCase()) {
      removeGitHubUsername()
      return owner
    }
  }

  if (username) return fetchOwnerProfile(username)

  throw new Error("尚未设置 GitHub 用户名或 Token。")
}

export function actionsStatusForRun(run: Pick<GitHubActionsRun, "workflowName" | "status" | "conclusion" | "updatedAt" | "htmlUrl">): GitHubActionsStatus {
  const base = { workflowName: run.workflowName, updatedAt: run.updatedAt, htmlUrl: run.htmlUrl }
  switch (run.status) {
    case "queued": return { ...base, state: "queued", label: "排队中", icon: "clock", color: "systemBlue" }
    case "waiting": return { ...base, state: "queued", label: "等待中", icon: "hourglass", color: "systemOrange" }
    case "requested":
    case "pending": return { ...base, state: "queued", label: "等待中", icon: "hourglass", color: "systemOrange" }
    case "in_progress": return { ...base, state: "running", label: "运行中", icon: "arrow.triangle.2.circlepath", color: "systemBlue" }
    case "completed": break
    default: return { ...base, state: "unknown", label: "状态未知", icon: "questionmark.circle", color: "secondaryLabel" }
  }
  switch (run.conclusion) {
    case "success": return { ...base, state: "success", label: "通过", icon: "checkmark.circle.fill", color: "systemGreen" }
    case "cancelled": return { ...base, state: "cancelled", label: "已取消", icon: "minus.circle.fill", color: "systemOrange" }
    case "skipped": return { ...base, state: "skipped", label: "已跳过", icon: "forward.end", color: "secondaryLabel" }
    case "timed_out": return { ...base, state: "timedOut", label: "已超时", icon: "clock.badge.xmark", color: "systemRed" }
    case "action_required": return { ...base, state: "actionRequired", label: "需要处理", icon: "exclamationmark.circle.fill", color: "systemOrange" }
    case "neutral": return { ...base, state: "neutral", label: "中性", icon: "circle.dotted", color: "secondaryLabel" }
    case "failure":
    case "startup_failure":
    case "stale": return { ...base, state: "failure", label: "失败", icon: "xmark.circle.fill", color: "systemRed" }
    default: return { ...base, state: "unknown", label: "结果未知", icon: "questionmark.circle", color: "secondaryLabel" }
  }
}

export async function fetchLatestActionsStatus(owner: string, repository: string, branch?: string): Promise<GitHubActionsStatus> {
  const query = branch ? `&branch=${encodeURIComponent(branch)}` : ""
  const payload = await requestJSON<{ workflow_runs: GitHubApiWorkflowRun[] }>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/runs?per_page=1${query}`)
  const run = payload.workflow_runs[0]
  if (!run) return { state: "unknown", label: "未配置 Actions", icon: "gearshape", color: "secondaryLabel", workflowName: null, updatedAt: null, htmlUrl: null }
  return actionsStatusForRun(mapActionsRun(run))
}

function mapReleaseAsset(asset: GitHubApiReleaseAsset): GitHubReleaseAsset {
  return { id: asset.id, name: asset.name, size: asset.size, contentType: asset.content_type, downloadCount: asset.download_count, downloadUrl: asset.url }
}

function mapRelease(release: GitHubApiRelease): GitHubRelease {
  return { id: release.id, tagName: release.tag_name, name: release.name ?? release.tag_name, body: release.body ?? "", isDraft: release.draft, isPrerelease: release.prerelease, publishedAt: release.published_at, createdAt: release.created_at, htmlUrl: release.html_url, assets: release.assets.map(mapReleaseAsset) }
}

export async function fetchRepositoryReleases(owner: string, repository: string): Promise<GitHubRelease[]> {
  return withPublicCache(`${repositoryCacheKey(owner, repository)}releases`, REPOSITORY_CACHE_TTL, async () => {
    const releases: GitHubRelease[] = []
    for (let page = 1; ; page += 1) {
      const batch = await requestJSON<GitHubApiRelease[]>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/releases?per_page=100&page=${page}`)
      releases.push(...batch.map(mapRelease))
      if (batch.length < 100) return releases
    }
  })
}

export async function fetchRepositoryLatestRelease(owner: string, repository: string): Promise<GitHubRelease | null> {
  try {
    const payload = await requestJSON<GitHubApiRelease>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/releases/latest`, {
      requireAuth: false,
    })
    return mapRelease(payload)
  } catch (caught) {
    if (caught instanceof GitHubRequestError && caught.status === 404) {
      return null
    }
    throw caught
  }
}

export async function downloadReleaseAsset(asset: GitHubReleaseAsset): Promise<Data> {
  let response: GitHubHTTPResponse & { data: () => Promise<Data> }
  try {
    response = await fetch(asset.downloadUrl, { headers: authHeaders("application/octet-stream") }) as typeof response
  } catch (caught) {
    throw new GitHubRequestError(caught instanceof Error ? `下载失败：${caught.message}` : "下载失败，请检查网络连接后重试。", 0)
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as GitHubError
    throw new GitHubRequestError(payload.message ?? `下载失败（${response.status}）。`, response.status)
  }
  return response.data()
}

export async function fetchRepositoryDefaultBranch(owner: string, repository: string): Promise<string> {
  return withPublicCache(`${repositoryCacheKey(owner, repository)}default-branch`, REPOSITORY_CACHE_TTL, async () => {
    const payload = await requestJSON<{ default_branch?: string }>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`)
    return payload.default_branch ?? "main"
  })
}

export async function fetchRepositoryBranches(owner: string, repository: string, fresh = false): Promise<GitHubBranch[]> {
  return withPublicCache(`${repositoryCacheKey(owner, repository)}branches`, REPOSITORY_CACHE_TTL, async () => {
    const branches: GitHubBranch[] = []
    for (let page = 1; ; page += 1) {
      const batch = await requestJSON<GitHubApiBranch[]>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/branches?per_page=100&page=${page}`)
      branches.push(...batch.map(branch => ({ name: branch.name, protected: branch.protected, sha: branch.commit.sha })))
      if (batch.length < 100) return branches
    }
  }, fresh)
}

export async function fetchRepositoryContents(owner: string, repository: string, path = "", ref?: string): Promise<GitHubContentItem[]> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const encodedPath = path.split("/").filter(Boolean).map(encodeURIComponent).join("/")
  const payload: GitHubApiContent[] = await withPublicCache(`${repositoryCacheKey(owner, repository)}contents:${ref ?? ""}:${path}`, REPOSITORY_CACHE_TTL, async () => {
    const response = await requestJSON<GitHubApiContent | GitHubApiContent[]>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}${query}`)
    return (Array.isArray(response) ? response : [response]).map(({ name, path, sha, size, type, html_url, download_url }) => ({ name, path, sha, size, type, html_url, download_url }))
  })
  return payload.map(item => ({
    name: item.name,
    path: item.path,
    sha: item.sha,
    size: item.size,
    type: item.type,
    htmlUrl: item.html_url,
    downloadUrl: item.download_url,
  })).sort((left, right) => left.type === right.type ? left.name.localeCompare(right.name) : left.type === "dir" ? -1 : 1)
}

const MAX_PREVIEW_FILE_BYTES = 1024 * 1024
const BINARY_FILE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "ico", "pdf", "zip", "gz", "tar", "7z", "rar", "mp3", "mp4", "mov", "avi", "wasm", "woff", "woff2", "ttf", "otf", "dmg", "ipa"])

export function isBinaryFilePath(path: string): boolean {
  return BINARY_FILE_EXTENSIONS.has(path.split(".").pop()?.toLocaleLowerCase() ?? "")
}

/** 读取文本文件用于只读预览：上限 1 MiB，拒绝二进制与非 UTF-8 内容。 */
export async function fetchRepositoryFile(owner: string, repository: string, path: string, ref?: string): Promise<string> {
  if (isBinaryFilePath(path)) throw new Error("该文件属于二进制类型，无法预览文本。请在 GitHub 中打开。")
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ""
  const encodedPath = path.split("/").filter(Boolean).map(encodeURIComponent).join("/")
  const payload = await requestJSON<GitHubApiContent>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}${query}`)
  if (payload.size > MAX_PREVIEW_FILE_BYTES) throw new Error("文件超过 1 MiB 预览上限，请在 GitHub 中打开。")
  if (!payload.content || payload.encoding !== "base64") throw new Error("GitHub 未返回可预览的文本内容。")
  const rawContent = Data.fromBase64String(payload.content.replace(/\s/g, ""))?.toRawString()
  if (rawContent === null || rawContent === undefined) throw new Error("文件不是有效的 UTF-8 文本。")
  return rawContent.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
}

function mapPullRequest(pullRequest: GitHubApiPullRequest): GitHubPullRequest {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body ?? "",
    htmlUrl: pullRequest.html_url,
    state: pullRequest.state,
    draft: pullRequest.draft,
    headBranch: pullRequest.head.ref,
    baseBranch: pullRequest.base.ref,
    authorName: pullRequest.user?.login ?? "未知作者",
    createdAt: pullRequest.created_at,
    updatedAt: pullRequest.updated_at,
  }
}

export async function fetchRepositoryPullRequests(owner: string, repository: string): Promise<GitHubPullRequest[]> {
  const pullRequests: GitHubPullRequest[] = []
  for (let page = 1; ; page += 1) {
    const payload = await requestJSON<GitHubApiPullRequest[]>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/pulls?state=open&sort=updated&direction=desc&per_page=100&page=${page}`)
    pullRequests.push(...payload.map(mapPullRequest))
    if (payload.length < 100) return pullRequests
  }
}

export async function fetchPullRequestFiles(owner: string, repository: string, number: number): Promise<GitHubPullRequestFile[]> {
  const payload = await requestJSON<GitHubApiPullRequestFile[]>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/pulls/${number}/files?per_page=100`)
  return payload.map(file => ({ filename: file.filename, status: file.status, additions: file.additions, deletions: file.deletions, changes: file.changes }))
}

export async function fetchRepositoryCommits(owner: string, repository: string, path = "", ref?: string): Promise<GitHubCommit[]> {
  const params = new URLSearchParams({ per_page: "30" })
  if (path) params.set("path", path)
  if (ref) params.set("sha", ref)
  return withPublicCache(`${repositoryCacheKey(owner, repository)}commits:${ref ?? ""}:${path}`, REPOSITORY_CACHE_TTL, async () => {
    const payload = await requestJSON<GitHubApiCommit[]>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits?${params.toString()}`)
    return payload.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message.split("\n")[0] ?? "无提交说明",
      htmlUrl: commit.html_url,
      authorName: commit.commit.author?.name ?? "未知作者",
      authorDate: commit.commit.author?.date ?? null,
    }))
  })
}

export async function fetchRepositoryContentUpdatedAt(owner: string, repository: string, path: string, ref?: string): Promise<string | null> {
  const params = new URLSearchParams({ per_page: "1", path })
  if (ref) params.set("sha", ref)
  return withPublicCache(`${repositoryCacheKey(owner, repository)}updated-at:${ref ?? ""}:${path}`, REPOSITORY_CACHE_TTL, async () => {
    const commits = await requestJSON<GitHubApiCommit[]>(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits?${params.toString()}`)
    return commits[0]?.commit.author?.date ?? null
  })
}

export function githubBlobURL(owner: string, repository: string, branch: string, path: string): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/blob/${encodeURIComponent(branch)}/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`
}

export function githubTreeURL(owner: string, repository: string, branch: string, path: string): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/tree/${encodeURIComponent(branch)}/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`
}

export function githubRawURL(owner: string, repository: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(branch)}/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`
}
