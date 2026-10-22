import {
  Button,
  HStack,
  Image,
  List,
  Menu,
  Navigation,
  NavigationStack,
  Section,
  Spacer,
  Text,
  Toolbar,
  ToolbarItem,
  VStack,
  useEffect,
  useState,
} from "scripting"
import { fetchOwnerProfile, fetchOwnerRepositories } from "./github-api"
import { ACCENT, compactNumber, DESIGN, errorStatusDetail, GITHUB_SYMBOL, GLASS, openGitHubWebPage, relativeTime, RepositoryIcon, RepositoryMetadata, StatusSurface } from "./glass-ui"
import { toggleFavorite, useFavorites } from "./favorites"
import { isSubscribedToReleases, toggleReleaseSubscription } from "./release-tracker"
import { openRepositoryFiles, openRepositoryReleases } from "./repository-pages"
import type { VirtualNode } from "scripting"
import type { GitHubOwnerProfile, GitHubRepository, LoadState } from "./types"

export async function openOwnerPage(login: string) {
  await Navigation.present(<NavigationStack><OwnerPage login={login} /></NavigationStack>)
}

/** 资料卡已在当前页显示时，只打开公开仓库列表。 */
export async function openOwnerRepositories(login: string) {
  await Navigation.present(<NavigationStack><OwnerPage login={login} showProfile={false} /></NavigationStack>)
}

/** 探索、作者主页、收藏、Stars 共用的仓库行：轻点展开只读操作菜单。 */
export function RepositoryRow({
  repository,
  favorite,
  showOwner = true,
  pinned,
  onTogglePinned,
  onSubscriptionsChange,
}: {
  repository: GitHubRepository
  favorite: boolean
  showOwner?: boolean
  pinned?: boolean
  onTogglePinned?: () => void
  onSubscriptionsChange?: () => void
}) {
  const [subscribed, setSubscribed] = useState(() => isSubscribedToReleases(repository.fullName))
  const githubAppURL = `github://github.com/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}`

  function toggleSubscription() {
    setSubscribed(toggleReleaseSubscription(repository.fullName))
    onSubscriptionsChange?.()
  }

  return (
    <Menu
      frame={{ maxWidth: "infinity", minHeight: DESIGN.touch }}
      contentShape={{ type: "rect", cornerRadius: DESIGN.rowRadius, style: "continuous" }}
      menuIndicator="hidden"
      menuStyle="button"
      buttonStyle="plain"
      glassEffect={GLASS.interactive}
      glassEffectTransition="materialize"
      label={
        <HStack spacing={12} alignment="center" padding={DESIGN.inset} frame={{ maxWidth: "infinity", minHeight: DESIGN.touch }} fixedSize={{ horizontal: false, vertical: true }} accessibilityLabel={`仓库操作 ${repository.fullName}`}>
          <RepositoryIcon repository={repository} size={42} />
          <VStack spacing={6} alignment="leading" frame={{ maxWidth: "infinity" }} fixedSize={{ horizontal: false, vertical: true }}>
            <HStack spacing={6} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Text font={16} fontWeight="semibold" foregroundStyle="label" lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }} multilineTextAlignment="leading">{showOwner ? repository.fullName : repository.name}</Text>
              {favorite ? <Image systemName="bookmark.fill" font={11} foregroundStyle="systemYellow" /> : null}
              {subscribed ? <Image systemName="bell.fill" font={11} foregroundStyle="systemRed" /> : null}
            </HStack>
            <Text font={13} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }} multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{repository.description ?? "暂无描述"}</Text>
            <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <RepositoryMetadata icon={GITHUB_SYMBOL} value={repository.language ?? "未标注"} color={ACCENT} />
              <RepositoryMetadata icon="star.fill" value={compactNumber(repository.stargazersCount)} color="systemOrange" />
              <RepositoryMetadata icon="arrow.triangle.branch" value={compactNumber(repository.forksCount)} color="systemPurple" />
              <RepositoryMetadata icon="clock" value={relativeTime(repository.pushedAt ?? repository.updatedAt)} />
            </HStack>
          </VStack>
          <Image systemName={pinned ? "pin.fill" : "ellipsis"} font={pinned ? 14 : 13} fontWeight="semibold" foregroundStyle={pinned ? ACCENT : "tertiaryLabel"} frame={{ minWidth: 20, maxHeight: "infinity" }} />
        </HStack>
      }
    >
      <Button title="浏览文件" systemImage="folder" action={() => { void openRepositoryFiles(repository) }} />
      <Button title="查看 Releases" systemImage="shippingbox" action={() => { void openRepositoryReleases(repository) }} />
      {showOwner ? <Button title={`作者主页 @${repository.owner.login}`} systemImage="person.crop.circle" action={() => { void openOwnerPage(repository.owner.login) }} /> : null}
      <Button title={favorite ? "取消收藏" : "收藏"} systemImage={favorite ? "bookmark.slash" : "bookmark"} action={() => { toggleFavorite(repository) }} />
      <Button title={subscribed ? "取消 Release 订阅" : "订阅 Release 更新"} systemImage={subscribed ? "bell.slash" : "bell"} action={toggleSubscription} />
      {onTogglePinned ? <Button title={pinned ? "取消置顶" : "置顶"} systemImage={pinned ? "pin.slash" : "pin"} action={onTogglePinned} /> : null}
      <Button title="在 GitHub 客户端中打开" systemImage={GITHUB_SYMBOL} action={() => { void Safari.openURL(githubAppURL) }} />
      <Button title="在 Safari 中打开" systemImage="safari" action={() => { void openGitHubWebPage(repository.htmlUrl, repository.fullName) }} />
    </Menu>
  )
}

type OwnerSort = "pushed" | "stars" | "name"
const OWNER_SORT_TITLE: Record<OwnerSort, string> = { pushed: "最近推送", stars: "Star 最多", name: "名称" }

/** 作者主页：用户或组织的资料与公开仓库（最近推送的前 100 个），公共浏览结果会缓存。showProfile 为 false 时只显示仓库列表。 */
export function OwnerPage({ login, showProfile = true }: { login: string; showProfile?: boolean }) {
  const dismiss = Navigation.useDismiss()
  const favorites = useFavorites()
  const [profile, setProfile] = useState<GitHubOwnerProfile | null>(null)
  const [repositories, setRepositories] = useState<GitHubRepository[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  const [sort, setSort] = useState<OwnerSort>("pushed")
  const [searchQuery, setSearchQuery] = useState("")

  async function load(fresh = false) {
    setState("loading")
    setError("")
    try {
      const [loadedProfile, loadedRepositories] = await Promise.all([fetchOwnerProfile(login, fresh), fetchOwnerRepositories(login, fresh)])
      setProfile(loadedProfile)
      setRepositories(loadedRepositories)
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取作者主页。")
      setState("error")
    }
  }

  useEffect(() => { void load() }, [login])

  const favoriteNames = new Set(favorites.map(favorite => favorite.fullName.toLowerCase()))
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleRepositories = repositories
    .filter(repository => !normalizedQuery || repository.name.toLocaleLowerCase().includes(normalizedQuery) || (repository.description ?? "").toLocaleLowerCase().includes(normalizedQuery))
    .sort((left, right) => sort === "stars"
      ? right.stargazersCount - left.stargazersCount
      : sort === "name"
        ? left.name.localeCompare(right.name)
        : new Date(right.pushedAt ?? right.updatedAt).getTime() - new Date(left.pushedAt ?? left.updatedAt).getTime())
  const profileURL = profile?.htmlUrl ?? `https://github.com/${encodeURIComponent(login)}`

  return (
    <List
      listStyle="inset"
      refreshable={() => load(true)}
      scrollContentBackground="hidden"
      scrollEdgeEffectHidden={{ edges: "top", hidden: true }}
      listRowBackground={<></>}
      listRowSeparator="hidden"
      background="systemGroupedBackground"
      navigationTitle={showProfile ? `@${profile?.login ?? login}` : "公开仓库"}
      navigationBarTitleDisplayMode="inline"
      searchable={{ value: searchQuery, onChanged: setSearchQuery, placement: "toolbar", prompt: "搜索仓库名称或描述" }}
      searchToolbarBehavior="minimize"
      toolbar={
        <Toolbar>
          <ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem>
          <ToolbarItem placement="topBarTrailing">
            <Menu label={<Image systemName="ellipsis.circle" foregroundStyle="label" frame={{ minWidth: 44, minHeight: 44 }} />}>
              <Button title="在 GitHub 客户端中打开" systemImage={GITHUB_SYMBOL} action={() => { void Safari.openURL(`github://github.com/${encodeURIComponent(login)}`) }} />
              <Button title="在 Safari 中打开" systemImage="safari" action={() => { void openGitHubWebPage(profileURL, `@${login}`) }} />
              <Button title="刷新" systemImage="arrow.clockwise" action={() => { void load(true) }} />
            </Menu>
          </ToolbarItem>
        </Toolbar>
      }
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          {showProfile && profile ? <OwnerProfileCard profile={profile} /> : null}
          {state === "loading" && !profile ? <StatusSurface icon="person.crop.circle" title="正在读取作者主页" detail={`正在读取 @${login} 的资料与公开仓库。`} loading /> : null}
          {state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取作者主页" detail={errorStatusDetail(error, "请检查网络后重试；公共浏览每小时限 60 次请求。")} action={() => { void load(true) }} /> : null}
          {state === "loaded" || repositories.length > 0 ? (
            <HStack spacing={8} padding={{ horizontal: 8, vertical: 2 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Text font={13} fontWeight="semibold" foregroundStyle="secondaryLabel">{`公开仓库 · ${visibleRepositories.length}${profile && profile.publicRepos > repositories.length ? ` / ${profile.publicRepos}` : ""}`}</Text>
              <Spacer />
              <Menu label={<Text font={12} fontWeight="medium" foregroundStyle={ACCENT}>排序：{OWNER_SORT_TITLE[sort]}</Text>}>
                {(Object.keys(OWNER_SORT_TITLE) as OwnerSort[]).map(candidate => <Button key={candidate} title={OWNER_SORT_TITLE[candidate]} systemImage={candidate === sort ? "checkmark" : "arrow.up.arrow.down"} action={() => setSort(candidate)} />)}
              </Menu>
            </HStack>
          ) : null}
          {state === "loaded" && repositories.length === 0 ? <StatusSurface icon="tray" title="没有公开仓库" detail="该作者还没有公开仓库。" /> : null}
          {state === "loaded" && repositories.length > 0 && visibleRepositories.length === 0 ? <StatusSurface icon="magnifyingglass" title="没有匹配的仓库" detail="换一个名称或描述关键词。" /> : null}
          {visibleRepositories.map(repository => <RepositoryRow key={String(repository.id)} repository={repository} favorite={favoriteNames.has(repository.fullName.toLowerCase())} showOwner={false} />)}
          {profile && profile.publicRepos > repositories.length ? <Text font={12} foregroundStyle="tertiaryLabel" frame={{ maxWidth: "infinity" }} multilineTextAlignment="center">仅显示最近推送的 {repositories.length} 个仓库，更多请在 Safari 中查看。</Text> : null}
        </VStack>
      </Section>
    </List>
  )
}

/** 用户 / 组织资料卡。传入 onOpenRepositories 时「仓库」统计可点击进入公开仓库；trailingBadge 显示在类型胶囊旁，accessory 显示在卡片底部。 */
/** 授权浏览时区分本人与他人；公共浏览不区分。 */
export type OwnerRelation = "self" | "other"

/**
 * compact 只显示头像、名称、胶囊与简介（Stars 页）；完整版另含统计与资料（设置页、作者主页）。
 * onOpenProfile 让 @用户名可点击进入作者主页。
 */
export function OwnerProfileCard({ profile, onOpenRepositories, onOpenProfile, relation, trailingBadge, headerAction, accessory, compact = false }: { profile: GitHubOwnerProfile; onOpenRepositories?: () => void; onOpenProfile?: () => void; relation?: OwnerRelation; trailingBadge?: VirtualNode; headerAction?: VirtualNode; accessory?: VirtualNode; compact?: boolean }) {
  const isOrganization = profile.type === "Organization"
  const typeLabel = isOrganization ? "组织" : relation === "self" ? "本人" : relation === "other" ? "他人" : "用户"
  const blogURL = profile.blog ? (/^https?:\/\//i.test(profile.blog) ? profile.blog : `https://${profile.blog}`) : null
  return (
    <VStack spacing={12} alignment="leading" padding={{ horizontal: 16, vertical: 16 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
      <HStack spacing={14} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Image imageUrl={profile.avatarUrl} resizable={true} aspectRatio={{ contentMode: "fill" }} frame={{ width: 64, height: 64 }} clipShape={isOrganization ? { type: "rect", cornerRadius: 14 } : "circle"} />
        <VStack spacing={4} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={19} fontWeight="semibold" lineLimit={1}>{profile.name ?? profile.login}</Text>
          {onOpenProfile ? (
            <Button action={onOpenProfile} buttonStyle="borderless" accessibilityLabel={`打开 @${profile.login} 的主页`}>
              <HStack spacing={3}>
                <Text font={13} fontWeight="medium" foregroundStyle={ACCENT}>@{profile.login}</Text>
                <Image systemName="chevron.right" font={10} fontWeight="semibold" foregroundStyle={ACCENT} />
              </HStack>
            </Button>
          ) : <Text font={13} foregroundStyle="secondaryLabel">@{profile.login}</Text>}
          <HStack spacing={6}>
            <HStack spacing={4} padding={{ horizontal: 9, vertical: 4 }} glassEffect={GLASS.capsule}>
              <Image systemName={isOrganization ? "building.2.fill" : "person.fill"} font={11} fontWeight="semibold" foregroundStyle={ACCENT} />
              <Text font={12} fontWeight="semibold" foregroundStyle={ACCENT}>{typeLabel}</Text>
            </HStack>
            {trailingBadge ?? null}
          </HStack>
        </VStack>
        {headerAction ? <VStack frame={{ height: 64, alignment: "top" }}>{headerAction}</VStack> : null}
      </HStack>
      {profile.bio ? <Text font={14} foregroundStyle="label" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{profile.bio}</Text> : null}
      {compact ? null : <HStack spacing={16} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {onOpenRepositories ? (
          <Button action={onOpenRepositories} buttonStyle="borderless" accessibilityLabel={`查看 ${profile.publicRepos} 个公开仓库`}>
            <OwnerStat value={profile.publicRepos} label="仓库" tappable />
          </Button>
        ) : <OwnerStat value={profile.publicRepos} label="仓库" />}
        <OwnerStat value={profile.followers} label="关注者" />
        {isOrganization ? null : <OwnerStat value={profile.following} label="正在关注" />}
      </HStack>}
      {!compact && profile.location ? <OwnerInfoLine icon="mappin.and.ellipse" text={profile.location} /> : null}
      {!compact && profile.company ? <OwnerInfoLine icon="building.2" text={profile.company} /> : null}
      {!compact && blogURL ? <Button action={() => { void openGitHubWebPage(blogURL, profile.blog ?? "") }} buttonStyle="plain"><OwnerInfoLine icon="link" text={profile.blog ?? ""} color={ACCENT} /></Button> : null}
      {compact ? null : <OwnerInfoLine icon="calendar" text={`加入于 ${new Date(profile.createdAt).toLocaleDateString()}`} />}
      {accessory ?? null}
    </VStack>
  )
}

function OwnerStat({ value, label, tappable = false }: { value: number; label: string; tappable?: boolean }) {
  return (
    <VStack spacing={1} alignment="leading">
      <Text font={16} fontWeight="semibold" foregroundStyle={tappable ? ACCENT : "label"}>{compactNumber(value)}</Text>
      <HStack spacing={2}>
        <Text font={11} foregroundStyle={tappable ? ACCENT : "secondaryLabel"}>{label}</Text>
        {tappable ? <Image systemName="chevron.right" font={9} fontWeight="semibold" foregroundStyle={ACCENT} /> : null}
      </HStack>
    </VStack>
  )
}

function OwnerInfoLine({ icon, text, color = "secondaryLabel" }: { icon: string; text: string; color?: import("scripting").Color }) {
  return (
    <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Image systemName={icon} font={12} foregroundStyle="secondaryLabel" frame={{ width: 18 }} />
      <Text font={13} foregroundStyle={color} lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>{text}</Text>
    </HStack>
  )
}
