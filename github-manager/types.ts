export type GitHubRepository = {
  id: number
  name: string
  fullName: string
  description: string | null
  htmlUrl: string
  language: string | null
  stargazersCount: number
  forksCount: number
  pushedAt: string | null
  starredAt: string | null
  updatedAt: string
  /** 列表接口自带；旧缓存数据可能缺失，缺失时再单独请求。 */
  defaultBranch?: string
  owner: {
    login: string
    avatarUrl: string
  }
}

export type GitHubAccount = {
  login: string
  name: string | null
  avatarUrl: string
  htmlUrl: string
}

export type LoadState = "idle" | "loading" | "loaded" | "error"

/** 可浏览文件的仓库：默认分支已确定。 */
export type BrowsableRepository = GitHubRepository & {
  defaultBranch: string
}

/** 作者主页：用户或组织。 */
export type GitHubOwnerProfile = GitHubAccount & {
  type: string
  bio: string | null
  company: string | null
  blog: string | null
  location: string | null
  followers: number
  following: number
  publicRepos: number
  createdAt: string
}

export type GitHubOwnedRepository = GitHubRepository & {
  defaultBranch: string
  private: boolean
  fork: boolean
  upstreamFullName: string | null
  size: number
  openIssuesCount: number
}

export type GitHubReleaseAsset = {
  id: number
  name: string
  size: number
  contentType: string
  downloadCount: number
  downloadUrl: string
}

export type GitHubRelease = {
  id: number
  tagName: string
  name: string
  body: string
  isDraft: boolean
  isPrerelease: boolean
  publishedAt: string | null
  createdAt: string
  htmlUrl: string
  assets: GitHubReleaseAsset[]
}

export type GitHubActionsStatus = {
  state: "success" | "failure" | "running" | "queued" | "cancelled" | "skipped" | "timedOut" | "actionRequired" | "neutral" | "unknown"
  label: string
  icon: string
  color: import("scripting").Color
  workflowName: string | null
  updatedAt: string | null
  htmlUrl: string | null
}

export type GitHubActionsRun = {
  id: number
  runNumber: number
  workflowName: string
  event: string
  branch: string | null
  status: string
  conclusion: string | null
  updatedAt: string | null
  htmlUrl: string
}

export type GitHubBranch = {
  name: string
  protected: boolean
  sha?: string
}

export type GitHubContentItem = {
  name: string
  path: string
  sha: string
  size: number
  type: "file" | "dir" | "symlink" | "submodule"
  htmlUrl: string
  downloadUrl: string | null
}

export type GitHubCommit = {
  sha: string
  message: string
  htmlUrl: string
  authorName: string
  authorDate: string | null
}

export type GitHubPullRequest = {
  number: number
  title: string
  body: string
  htmlUrl: string
  state: "open" | "closed"
  draft: boolean
  headBranch: string
  baseBranch: string
  authorName: string
  createdAt: string
  updatedAt: string
}

export type GitHubPullRequestFile = {
  filename: string
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "changed"
  additions: number
  deletions: number
  changes: number
}

/** 应用只读。token：以 Token 身份读取（5000 次/小时）；public：仅用户名读取公开数据；none：尚未选择。 */
export type AccessMode = "token" | "public" | "none"

/** Token 元数据（不含 Token 本身），保存在 Storage；Token 只存在钥匙串。 */
export type TokenInfo = {
  kind: "fine-grained" | "classic" | "other"
  suffix: string
  /** passcode：需设备密码；unlocked_this_device：解锁后可读。两者均仅此设备、不同步 iCloud。 */
  storage: "passcode" | "unlocked_this_device"
  expiresAt: string | null
  verifiedAt: string | null
  /** Token 所属账户，验证后记录，用于判断当前是否在浏览自己。 */
  login?: string
}
