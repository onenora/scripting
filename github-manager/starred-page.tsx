import {
  Button,
  HStack,
  Image,
  List,
  Navigation,
  NavigationStack,
  Section,
  Tab,
  TabView,
  Text,
  Toolbar,
  ToolbarItem,
  VStack,
  ZStack,
  useEffect,
  useState,
} from "scripting"
import {
  currentBrowseIdentity,
  fetchCurrentGitHubAccount,
  fetchStarredRepositoriesPage,
  getGitHubUsername,
  isBrowsingTokenOwner,
  GitHubRequestError,
  migrateLegacyStarsCache,
  readAccessMode,
  readCachedAccount,
  readCachedStars,
  readStarsNextPage,
  readStarsSyncedAt,
  readTokenInfo,
  recordBrowseUser,
  pauseGitHubToken,
  removeGitHubToken,
  resumeGitHubToken,
  removeGitHubUsername,
  saveCachedAccount,
  saveCachedStars,
  saveGitHubToken,
  saveGitHubUsername,
  saveStarsNextPage,
  saveStarsSyncedAt,
  upgradeTokenProtection,
} from "./github-api"
import { errorStatusDetail, GLASS, MODE_STYLE, ModeBadge, PageBackground, StatusSurface } from "./glass-ui"
import { AccountPage, ModeChooser, type AccountActions } from "./account-page"
import { MyRepositoriesPage } from "./my-repositories-page"
import { ExplorePage } from "./explore-page"
import { FavoritesPage } from "./favorites-page"
import { openOwnerPage, openOwnerRepositories, OwnerProfileCard, RepositoryRow } from "./repository-browser"
import { useFavorites } from "./favorites"
import { convertGitHubLinkFromClipboard } from "./raw-link-page"
import { readPinnedRepositoryIDs, savePinnedRepositoryIDs } from "./pinned-repositories"
import { getUnreadReleaseCount } from "./release-tracker"
import { ReleaseTrackerPage } from "./release-tracker-page"
import type { AccessMode, GitHubOwnerProfile, GitHubRepository, LoadState } from "./types"

migrateLegacyStarsCache()

/** 每批渲染的 Star 数量，避免一次渲染上千行导致卡顿。 */
const RENDER_BATCH = 20

type PresentationStyle = "automatic" | "overFullScreen"
type PresentationResult =
  | { type: "close-script" }
  | { type: "change-presentation-style"; style: PresentationStyle }

/** homeScreen：作为 Scripting 首页标签显示，只有 Stars 列表。 */
export default function StarredPage({ presentationStyle = "automatic", homeScreen = false }: { presentationStyle?: PresentationStyle; homeScreen?: boolean }) {
  const dismiss = Navigation.useDismiss()
  const favorites = useFavorites()
  const [mode, setMode] = useState<AccessMode>(readAccessMode)
  const [repositories, setRepositories] = useState<GitHubRepository[]>(readCachedStars)
  const [syncedAt, setSyncedAt] = useState<string | null>(readStarsSyncedAt)
  const [account, setAccount] = useState<GitHubOwnerProfile | null>(readCachedAccount)
  const [accountState, setAccountState] = useState<LoadState>(() => (readCachedAccount() ? "loaded" : "idle"))
  const [state, setState] = useState<LoadState>(() => (readCachedStars().length > 0 ? "loaded" : "idle"))
  const [error, setError] = useState("")
  const [nextPage, setNextPage] = useState<number | null>(readStarsNextPage)
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pinnedIDs, setPinnedIDs] = useState(readPinnedRepositoryIDs)
  const [unreadReleaseCount, setUnreadReleaseCount] = useState(getUnreadReleaseCount)
  const [tokenInfo, setTokenInfo] = useState(readTokenInfo)

  const isTokenMode = mode === "token"
  const browsingSelf = isTokenMode && isBrowsingTokenOwner()
  const fullScreen = presentationStyle === "overFullScreen"
  const modeStyle = MODE_STYLE[mode]
  const favoriteNames = new Set(favorites.map(favorite => favorite.fullName.toLowerCase()))

  function refreshSubscriptions() {
    setUnreadReleaseCount(getUnreadReleaseCount())
  }

  const repositoryByID = new Map(repositories.map(repository => [repository.id, repository]))
  const pinnedRepositories = pinnedIDs.flatMap(id => {
    const repository = repositoryByID.get(id)
    return repository ? [repository] : []
  })
  const unpinnedRepositories = repositories.filter(repository => !pinnedIDs.includes(repository.id))
  const visibleRepositories = unpinnedRepositories.slice(0, visibleCount)
  const hasMore = visibleCount < unpinnedRepositories.length || nextPage !== null

  function togglePinned(id: number) {
    const next = pinnedIDs.includes(id) ? pinnedIDs.filter(pinnedID => pinnedID !== id) : [id, ...pinnedIDs]
    savePinnedRepositoryIDs(next)
    setPinnedIDs(next)
  }

  /** 浏览对象变化后显示该用户已持久化的资料与 Star；没有快照时为空，等待加载。 */
  function showIdentitySnapshot() {
    const cachedStars = readCachedStars()
    const cachedAccount = readCachedAccount()
    setMode(readAccessMode())
    setRepositories(cachedStars)
    setSyncedAt(readStarsSyncedAt())
    setNextPage(readStarsNextPage())
    setVisibleCount(RENDER_BATCH)
    setAccount(cachedAccount)
    setAccountState(cachedAccount ? "loaded" : "idle")
    setError("")
    setState(cachedStars.length > 0 ? "loaded" : "idle")
  }

  async function loadRepositories(isManual = false) {
    const currentMode = readAccessMode()
    setMode(currentMode)
    if (currentMode === "none") {
      showIdentitySnapshot()
      return
    }

    setAccountState("loading")
    setState("loading")
    setError("")
    try {
      try {
        const loadedAccount = await fetchCurrentGitHubAccount()
        setTokenInfo(readTokenInfo())
        setAccount(loadedAccount)
        saveCachedAccount(loadedAccount)
        if (getGitHubUsername()) recordBrowseUser(loadedAccount.login)
        setAccountState("loaded")
      } catch {
        setAccountState("error")
        if (!readCachedAccount()) setAccount(null)
      }
      // 刷新只请求第一页，其余在「加载更多」时按需请求。
      const identity = currentBrowseIdentity()
      const firstPage = await fetchStarredRepositoriesPage(1)
      // 请求期间已切换到其他用户：丢弃结果，避免写入别人的快照。
      if (currentBrowseIdentity() !== identity) return
      const now = new Date().toISOString()
      setRepositories(firstPage.repositories)
      saveCachedStars(firstPage.repositories)
      setNextPage(firstPage.nextPage)
      saveStarsNextPage(firstPage.nextPage)
      setVisibleCount(RENDER_BATCH)
      setSyncedAt(now)
      saveStarsSyncedAt(now)
      setState("loaded")
    } catch (caught) {
      const cached = readCachedStars()
      if (cached.length > 0) {
        setRepositories(cached)
        setState("loaded")
        if (isManual) {
          await Dialog.alert({
            title: "刷新失败",
            message: caught instanceof Error ? caught.message : "无法拉取最新 Star 列表，已为你保留本地缓存数据。",
          })
        }
      } else {
        setError(caught instanceof Error ? caught.message : "无法读取 GitHub Star。")
        setState("error")
      }
    }
  }

  /** 先展开已加载的数据；本地不足一批时才请求下一页。 */
  async function showMore() {
    if (loadingMore) return
    const target = visibleCount + RENDER_BATCH
    if (target > unpinnedRepositories.length && nextPage !== null) {
      setLoadingMore(true)
      try {
        const page = await fetchStarredRepositoriesPage(nextPage)
        const knownIDs = new Set(repositories.map(repository => repository.id))
        const merged = [...repositories, ...page.repositories.filter(repository => !knownIDs.has(repository.id))]
        setRepositories(merged)
        saveCachedStars(merged)
        setNextPage(page.nextPage)
        saveStarsNextPage(page.nextPage)
      } catch (caught) {
        await Dialog.alert({ title: "加载失败", message: caught instanceof Error ? caught.message : "无法读取更多 Star。" })
        return
      } finally {
        setLoadingMore(false)
      }
    }
    setVisibleCount(target)
  }

  /** 保存前先验证：401 直接拒绝，避免把无效 Token 留在钥匙串里。 */
  async function configureToken() {
    const token = await Dialog.prompt({
      title: isTokenMode ? "更换 GitHub Token" : "添加 GitHub Token",
      message: `Token 只用于把限额提升至 5000 次/小时并读取你自己的私有仓库，浏览哪个用户可随时切换。Token 加密保存在本机钥匙串，仅此设备可读、不同步 iCloud。

建议只授予读取权限：
• Fine-grained：Public repositories + Starring：Read-only
• Classic：不勾任何 scope`,
      placeholder: "github_pat_...",
      obscureText: true,
      confirmLabel: "验证并保存",
    })
    if (!token?.trim()) return

    if (!saveGitHubToken(token)) {
      await Dialog.alert({ title: "无法保存", message: "钥匙串未能保存 Token，请检查设备权限后重试。" })
      return
    }
    try {
      await fetchCurrentGitHubAccount()
    } catch (caught) {
      if (caught instanceof GitHubRequestError && caught.status === 401) {
        removeGitHubToken()
        setTokenInfo(null)
        setMode(readAccessMode())
        await Dialog.alert({ title: "Token 无效", message: "GitHub 拒绝了该 Token（401），未保存。请检查是否复制完整或已过期。" })
        return
      }
      // 网络等临时错误：保留 Token，可在设置页重新验证。
    }
    showIdentitySnapshot()
    setTokenInfo(readTokenInfo())
    await loadRepositories(true)
  }

  async function upgradeProtection() {
    const updated = upgradeTokenProtection()
    if (!updated) {
      await Dialog.alert({ title: "无法更新钥匙串", message: "未能重新写入 Token，原 Token 可能已失效，请重新添加。" })
    } else if (updated.storage !== "passcode") {
      await Dialog.alert({ title: "未设置设备密码", message: "需要先在系统设置中开启设备密码，才能使用需设备密码的保护等级。当前仍为解锁后可读。" })
    }
    setTokenInfo(readTokenInfo())
    setMode(readAccessMode())
  }

  /** 两种方式行为一致：浏览任意用户；授权浏览只是请求带 Token 以放宽限额。返回是否已切换。 */
  async function configureUsername(): Promise<boolean> {
    const tokenActive = readAccessMode() === "token"
    const current = getGitHubUsername()
    const input = await Dialog.prompt({
      title: mode === "none" ? "公共浏览" : "切换浏览用户",
      message: tokenActive ? "输入任意 GitHub 用户名浏览其主页与公开 Star，请求仍使用 Token 的限额。" : "输入任意 GitHub 用户名，浏览其主页与公开 Star，无需 Token。",
      defaultValue: current ?? "",
      placeholder: "例如 torvalds、octocat",
      confirmLabel: "开始浏览",
    })
    const trimmed = input?.trim()
    if (!trimmed || trimmed.toLowerCase() === current?.toLowerCase()) return false
    // 不等待加载完成，切换页可立即关闭。
    void switchBrowseUser(trimmed)
    return true
  }

  /** login 为 null 表示回到 Token 所属账户。有快照直接显示，没有时才请求一次。 */
  async function switchBrowseUser(login: string | null) {
    const owner = readTokenInfo()?.login
    if (readAccessMode() === "token" && (!login || login.toLowerCase() === owner?.toLowerCase())) {
      removeGitHubUsername()
    } else if (login) {
      saveGitHubUsername(login)
      recordBrowseUser(login)
    } else {
      return
    }
    showIdentitySnapshot()
    if (readCachedStars().length === 0) await loadRepositories(true)
  }

  /** 退出授权：Token 保留在钥匙串，只切换为公共浏览，之后可一键恢复。 */
  async function signOutToken() {
    const fallbackUser = getGitHubUsername() ?? account?.login ?? null
    const confirmed = await Dialog.confirm({
      title: "退出授权",
      message: `Token 仍保存在钥匙串，可在设置中随时恢复授权浏览。${fallbackUser ? `\n\n退出后以公共浏览继续查看 @${fallbackUser} 的公开 Star。` : ""}`,
      confirmLabel: "退出授权",
      cancelLabel: "取消",
    })
    if (!confirmed) return
    pauseGitHubToken()
    if (fallbackUser) saveGitHubUsername(fallbackUser)
    showIdentitySnapshot()
    setTokenInfo(readTokenInfo())
    setMode(readAccessMode())
  }

  async function resumeToken() {
    resumeGitHubToken()
    showIdentitySnapshot()
    setTokenInfo(readTokenInfo())
    await loadRepositories(true)
  }

  /** 从钥匙串永久删除；正在授权浏览时同时退回公共浏览。 */
  async function deleteToken() {
    const wasActive = readAccessMode() === "token"
    const fallbackUser = getGitHubUsername() ?? account?.login ?? null
    const confirmed = await Dialog.confirm({
      title: "删除 Token",
      message: "将从钥匙串永久删除 Token，之后需重新粘贴才能授权浏览。",
      confirmLabel: "删除",
      cancelLabel: "取消",
    })
    if (!confirmed) return
    removeGitHubToken()
    setTokenInfo(null)
    if (wasActive) {
      if (fallbackUser) saveGitHubUsername(fallbackUser)
      showIdentitySnapshot()
    }
    setMode(readAccessMode())
  }

  function removeUsername() {
    removeGitHubUsername()
    showIdentitySnapshot()
    setMode(readAccessMode())
  }



  function handleClose() {
    dismiss({ type: "close-script" } satisfies PresentationResult)
  }

  /** 资料卡「仓库」：浏览本人时打开我的仓库（含私有），否则打开该用户的公开仓库。 */
  function openAccountRepositories(login: string) {
    if (isBrowsingTokenOwner()) void Navigation.present(<NavigationStack><MyRepositoriesPage /></NavigationStack>)
    else void openOwnerRepositories(login)
  }

  /** 右上角按钮：重新以新样式呈现。 */
  function changePresentationStyle(fullScreen: boolean) {
    const nextStyle: PresentationStyle = fullScreen ? "overFullScreen" : "automatic"
    if (nextStyle !== presentationStyle) dismiss({ type: "change-presentation-style", style: nextStyle } satisfies PresentationResult)
  }

  useEffect(() => {
    // 启动只显示本地缓存；公共浏览完全手动刷新，授权浏览仅在无任何缓存时自动拉取一次。
    if (readAccessMode() === "token" && readCachedStars().length === 0) {
      void loadRepositories()
    }
  }, [])

  const accountActions: AccountActions = {
    onConfigureUsername: configureUsername,
    onSwitchBrowseUser: switchBrowseUser,
    onRemoveUsername: removeUsername,
    onConfigureToken: configureToken,
    onSignOutToken: signOutToken,
    onResumeToken: resumeToken,
    onDeleteToken: deleteToken,
    onVerifyToken: () => loadRepositories(true),
    onUpgradeTokenProtection: upgradeProtection,
    onOpenOwnerRepositories: openAccountRepositories,
    onConvertRawLink: () => { void convertGitHubLinkFromClipboard() },
  }

  const renderRow = (repository: GitHubRepository, pinned: boolean) => (
    <RepositoryRow
      key={repository.id}
      repository={repository}
      favorite={favoriteNames.has(repository.fullName.toLowerCase())}
      pinned={pinned}
      onTogglePinned={() => togglePinned(repository.id)}
      onSubscriptionsChange={refreshSubscriptions}
    />
  )

  const starsBadges = (
    <HStack spacing={6}>
      <ModeBadge mode={mode} />
      <StarsBadge total={repositories.length} complete={nextPage === null} state={state} syncedAt={syncedAt} />
    </HStack>
  )

  const repositoryList = (
    <List
      listStyle="inset"
      refreshable={() => loadRepositories(true)}
      scrollContentBackground="hidden"
      scrollEdgeEffectHidden={{ edges: "top", hidden: true }}
      listRowBackground={<></>}
      listRowSeparator="hidden"
      navigationBarTitleDisplayMode="inline"
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          {mode === "none" ? (
            <ModeChooser onChoosePublic={() => { void configureUsername() }} onChooseToken={accountActions.onConfigureToken} />
          ) : account ? (
            <OwnerProfileCard profile={account} onOpenProfile={() => { void openOwnerPage(account.login) }} relation={isTokenMode ? (browsingSelf ? "self" : "other") : undefined} trailingBadge={starsBadges} compact />
          ) : (
            <HStack padding={{ horizontal: 16, vertical: 12 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>{starsBadges}</HStack>
          )}
          {mode === "public" && state === "idle" ? <StatusSurface icon="icloud.and.arrow.down" iconForegroundStyle={modeStyle.color} title="尚未加载" detail="公共浏览不会自动请求 GitHub。点击加载或下拉刷新读取该用户的公开 Star，结果会缓存到本机。" action={() => { void loadRepositories(true) }} actionTitle="加载 Star" actionSystemImage="arrow.down.circle" /> : null}
          {browsingSelf && accountState === "error" ? <StatusSurface icon="exclamationmark.shield.fill" iconForegroundStyle="systemOrange" title="Token 验证失败" detail="Token 可能已过期或被撤销，请重新验证或更换。" action={accountActions.onConfigureToken} actionTitle="更换 Token" actionSystemImage="key.horizontal" /> : null}
          {state === "loading" && repositories.length === 0 ? <StatusSurface icon="arrow.triangle.2.circlepath" iconForegroundStyle={modeStyle.color} title="正在更新" detail="正在读取最近 Star 的仓库。" loading /> : null}
          {state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="更新失败" detail={errorStatusDetail(error, isTokenMode ? "请检查网络连接或 Token 是否有效后重试。" : "请检查用户名是否正确、网络是否可用；若提示限额，请稍后再试或添加 Token。")} action={() => { void loadRepositories() }} /> : null}
          {state === "loaded" && repositories.length === 0 ? <StatusSurface icon="star.slash" title="还没有已加星的仓库" detail={browsingSelf ? "你的账户还没有 Star 任何仓库，可以去探索页看看。" : "该用户没有公开的 Star 仓库。"} /> : null}
          {pinnedRepositories.map(repository => renderRow(repository, true))}
          {visibleRepositories.map(repository => renderRow(repository, false))}
          {state === "loaded" && hasMore ? (
            <Button
              title={loadingMore ? "正在加载…" : `加载更多 · 已显示 ${pinnedRepositories.length + visibleRepositories.length} / ${repositories.length}${nextPage !== null ? "+" : ""}`}
              systemImage={loadingMore ? "hourglass" : "arrow.down.circle"}
              tint={modeStyle.color}
              disabled={loadingMore}
              action={() => { void showMore() }}
              buttonStyle="borderless"
              frame={{ maxWidth: "infinity" }}
              padding={{ vertical: 12 }}
              glassEffect={GLASS.interactiveCapsule}
            />
          ) : null}
        </VStack>
      </Section>
    </List>
  )

  const tabToolbar = (
    <Toolbar>
      <ToolbarItem placement="topBarLeading" sharedBackgroundVisibility="visible">
        <Button title="关闭" systemImage="xmark" action={handleClose} buttonStyle="plain" frame={{ minWidth: 44, minHeight: 44 }} />
      </ToolbarItem>
      <ToolbarItem placement="topBarTrailing" sharedBackgroundVisibility="visible">
        <Button
          title={fullScreen ? "退出全面屏" : "全面屏显示"}
          systemImage={fullScreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"}
          action={() => changePresentationStyle(!fullScreen)}
          buttonStyle="plain"
          frame={{ minWidth: 44, minHeight: 44 }}
        />
      </ToolbarItem>
    </Toolbar>
  )

  // 首页标签已在 App 的标签栏中，只显示 Stars，避免嵌套出第二排标签栏。
  if (homeScreen) {
    return (
      <ZStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
        <PageBackground />
        <NavigationStack>{repositoryList}</NavigationStack>
      </ZStack>
    )
  }

  return (
    <ZStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      <PageBackground />
      <NavigationStack>
        {/* iPhone 为底部标签栏；iPad / Mac 宽屏为可收起的侧边栏。 */}
        <TabView tabViewStyle="sidebarAdaptable" toolbar={tabToolbar}>
          <Tab title="探索" systemImage="sparkles" value="explore"><NavigationStack><ExplorePage mode={mode} onSubscriptionsChange={refreshSubscriptions} /></NavigationStack></Tab>
          <Tab title={favorites.length > 0 ? `收藏 (${favorites.length})` : "收藏"} systemImage="bookmark.fill" value="favorites"><NavigationStack><FavoritesPage onSubscriptionsChange={refreshSubscriptions} /></NavigationStack></Tab>
          <Tab title="Stars" systemImage="star.fill" value="stars"><NavigationStack>{repositoryList}</NavigationStack></Tab>
          <Tab title={unreadReleaseCount > 0 ? `Releases (${unreadReleaseCount})` : "Releases"} systemImage={unreadReleaseCount > 0 ? "bell.badge.fill" : "bell.fill"} value="releases"><NavigationStack><ReleaseTrackerPage onSubscriptionsChange={refreshSubscriptions} /></NavigationStack></Tab>
          <Tab title="设置" systemImage="gearshape.fill" value="account"><NavigationStack><AccountPage mode={mode} account={account} accountState={accountState} username={getGitHubUsername()} tokenInfo={tokenInfo} actions={accountActions} /></NavigationStack></Tab>
        </TabView>
      </NavigationStack>
    </ZStack>
  )
}


function formatSyncTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  return isToday ? time : `${d.getMonth() + 1}/${d.getDate()}`
}

/** Stars 胶囊：与「用户」「授权浏览」同样式，显示数量与同步时间。 */
function StarsBadge({ total, complete, state, syncedAt }: { total: number; complete: boolean; state: LoadState; syncedAt: string | null }) {
  const text = state === "loading"
    ? "同步中…"
    : state === "loaded"
      ? `${total}${complete ? "" : "+"}${syncedAt ? ` · ${formatSyncTime(syncedAt)}` : ""}`
      : "未加载"
  return (
    <HStack spacing={4} padding={{ horizontal: 9, vertical: 4 }} glassEffect={GLASS.capsule} accessibilityLabel={`Star ${text}`}>
      <Image systemName="star.fill" font={11} fontWeight="semibold" foregroundStyle="systemYellow" />
      <Text font={12} fontWeight="semibold" foregroundStyle="secondaryLabel" lineLimit={1}>{text}</Text>
    </HStack>
  )
}
