import {
  Button,
  HStack,
  Image,
  List,
  Menu,
  Navigation,
  NavigationStack,
  Section,
  Text,
  Toolbar,
  ToolbarItem,
  VStack,
  useEffect,
  useRef,
  useState,
} from "scripting"
import { fetchLatestActionsStatus, fetchOwnedRepositories } from "./github-api"
import { ACCENT, DESIGN, errorStatusDetail, GITHUB_SYMBOL, GLASS, IconButton, openGitHubWebPage, relativeTime, RepositoryIcon, StatusSurface } from "./glass-ui"
import { openRepositoryFiles, openRepositoryReleases, RepositoryActionsPage } from "./repository-pages"
import type { GitHubActionsStatus, GitHubOwnedRepository, LoadState } from "./types"

/** 授权浏览下 Token 所属账户的仓库（含私有），只读浏览。 */
export function MyRepositoriesPage() {
  const dismiss = Navigation.useDismiss()
  const [repositories, setRepositories] = useState<GitHubOwnedRepository[]>([])
  const [actionsStatuses, setActionsStatuses] = useState<Record<number, GitHubActionsStatus>>({})
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const refreshID = useRef(0)

  async function loadActionsStatuses(repositories: GitHubOwnedRepository[]): Promise<Record<number, GitHubActionsStatus>> {
    const candidates = repositories.slice(0, 20)
    const statuses: Record<number, GitHubActionsStatus> = {}
    for (let start = 0; start < candidates.length; start += 3) {
      const batch = candidates.slice(start, start + 3)
      const entries = await Promise.all(batch.map(async repository => {
        try {
          return [repository.id, await fetchLatestActionsStatus(repository.owner.login, repository.name, repository.defaultBranch)] as const
        } catch {
          return [repository.id, { state: "unknown", label: "状态不可用", icon: "questionmark.circle", color: "secondaryLabel", workflowName: null, updatedAt: null, htmlUrl: null } satisfies GitHubActionsStatus] as const
        }
      }))
      for (const [id, status] of entries) statuses[id] = status
    }
    return statuses
  }

  async function load() {
    const requestID = refreshID.current + 1
    refreshID.current = requestID
    setState("loading")
    setError("")
    try {
      const loadedRepositories = await fetchOwnedRepositories()
      if (refreshID.current !== requestID) return
      setRepositories(loadedRepositories)
      setState("loaded")
      const loadedStatuses = await loadActionsStatuses(loadedRepositories)
      if (refreshID.current === requestID) setActionsStatuses(loadedStatuses)
    } catch (caught) {
      if (refreshID.current !== requestID) return
      setError(caught instanceof Error ? caught.message : "无法读取我的仓库。")
      setState("error")
    }
  }

  useEffect(() => { void load() }, [])

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleRepositories = repositories.filter(repository => !normalizedQuery || repository.fullName.toLocaleLowerCase().includes(normalizedQuery) || (repository.description ?? "").toLocaleLowerCase().includes(normalizedQuery))
  const privateCount = repositories.filter(repository => repository.private).length
  const forkCount = repositories.filter(repository => repository.fork).length

  return (
    <List
      listStyle="inset"
      refreshable={load}
      scrollContentBackground="hidden"
      scrollEdgeEffectHidden={{ edges: "top", hidden: true }}
      listRowBackground={<></>}
      listRowSeparator="hidden"
      navigationTitle="我的仓库"
      navigationBarTitleDisplayMode="inline"
      background="systemGroupedBackground"
      searchable={{ value: searchQuery, onChanged: setSearchQuery, placement: "toolbar", prompt: "搜索仓库名称或描述" }}
      searchToolbarBehavior="minimize"
      toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem><ToolbarItem placement="topBarTrailing"><IconButton icon="arrow.clockwise" label="刷新我的仓库" action={() => { void load() }} /></ToolbarItem></Toolbar>}
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          <VStack spacing={6} alignment="leading" padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
            <HStack spacing={8}><Image systemName="shippingbox.fill" font={15} foregroundStyle={ACCENT} /><Text font={18} fontWeight="semibold">我的仓库</Text></HStack>
            <Text font={13} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>Token 所属账户拥有的仓库（含私有），只读浏览目录、提交、Actions 与 Release。最近更新的 20 个仓库显示 Actions 状态。</Text>
            <Text font={12} fontWeight="medium" foregroundStyle="secondaryLabel">{state === "loaded" ? `${repositories.length} 个仓库 · ${privateCount} 个私有 · ${forkCount} 个 Fork` : state === "loading" ? "加载中" : "加载失败"}</Text>
          </VStack>
          {state === "loading" && repositories.length === 0 ? <StatusSurface icon="arrow.triangle.2.circlepath" title="正在读取仓库" detail="正在从 GitHub 读取你拥有的仓库。" loading /> : null}
          {state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取仓库" detail={errorStatusDetail(error)} action={() => { void load() }} /> : null}
          {state === "loaded" && repositories.length === 0 ? <StatusSurface icon="tray" title="没有自己的仓库" detail="GitHub 没有返回当前 Token 所属账户的仓库。" /> : null}
          {state === "loaded" && repositories.length > 0 && visibleRepositories.length === 0 ? <StatusSurface icon="magnifyingglass" title="没有匹配的仓库" detail="换一个名称或描述关键词。" /> : null}
          {visibleRepositories.map(repository => <OwnedRepositoryRow key={String(repository.id)} repository={repository} actionsStatus={actionsStatuses[repository.id]} />)}
        </VStack>
      </Section>
    </List>
  )
}

function OwnedRepositoryRow({ repository, actionsStatus }: { repository: GitHubOwnedRepository; actionsStatus?: GitHubActionsStatus }) {
  const githubAppURL = `github://github.com/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}`
  const label = (
    <HStack spacing={12} padding={14} frame={{ maxWidth: "infinity", minHeight: 78 }} fixedSize={{ horizontal: false, vertical: true }}>
      <RepositoryIcon repository={repository} size={42} />
      <VStack spacing={5} alignment="leading" frame={{ maxWidth: "infinity" }}>
        <HStack spacing={6}><Text font={16} fontWeight="semibold" lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{repository.name}</Text>{repository.private ? <Image systemName="lock.fill" font={11} foregroundStyle="secondaryLabel" /> : null}</HStack>
        <Text font={13} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }} multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{repository.description ?? "暂无描述"}</Text>
        {actionsStatus ? <HStack spacing={6} frame={{ maxWidth: "infinity", alignment: "leading" }}><Image systemName={actionsStatus.icon} font={11} fontWeight="semibold" foregroundStyle={actionsStatus.color} /><Text font={12} fontWeight="medium" foregroundStyle={actionsStatus.color}>{actionsStatus.label}</Text>{actionsStatus.workflowName ? <Text font={12} foregroundStyle="tertiaryLabel" lineLimit={1}>{actionsStatus.workflowName}</Text> : null}{actionsStatus.updatedAt ? <Text font={12} foregroundStyle="tertiaryLabel">{relativeTime(actionsStatus.updatedAt)}</Text> : null}</HStack> : null}
        <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <HStack spacing={7}><Image systemName="arrow.triangle.branch" font={11} fontWeight="semibold" foregroundStyle={ACCENT} /><Text font={12} fontWeight="medium" foregroundStyle={ACCENT}>{repository.defaultBranch}</Text></HStack>
          {repository.fork ? <HStack spacing={5}><Image systemName="tuningfork" font={11} fontWeight="semibold" foregroundStyle="systemPurple" /><Text font={12} fontWeight="semibold" foregroundStyle="systemPurple">Fork</Text></HStack> : null}
        </HStack>
      </VStack>
      <Image systemName="chevron.right" font={12} fontWeight="semibold" foregroundStyle="tertiaryLabel" />
    </HStack>
  )
  return (
    <Menu primaryAction={() => { void openRepositoryFiles(repository) }} frame={{ maxWidth: "infinity", minHeight: 78 }} contentShape={{ type: "rect", cornerRadius: DESIGN.rowRadius, style: "continuous" }} menuIndicator="hidden" menuStyle="button" buttonStyle="plain" glassEffect={GLASS.interactive} glassEffectTransition="materialize" label={label} accessibilityLabel={`仓库 ${repository.fullName}`}>
      <Button title="浏览文件" systemImage="folder" action={() => { void openRepositoryFiles(repository) }} />
      <Button title="查看 Releases" systemImage="shippingbox" action={() => { void openRepositoryReleases(repository) }} />
      <Button title="查看 Actions 运行" systemImage="checkmark.circle" action={() => { void Navigation.present(<NavigationStack><RepositoryActionsPage repository={repository} branch={repository.defaultBranch} /></NavigationStack>) }} />
      <Button title="在 GitHub 客户端中打开" systemImage={GITHUB_SYMBOL} action={() => { void Safari.openURL(githubAppURL) }} />
      <Button title="在 Safari 中打开" systemImage="safari" action={() => { void openGitHubWebPage(repository.htmlUrl, repository.fullName) }} />
    </Menu>
  )
}
