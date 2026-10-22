import {
  Button,
  Editor,
  HStack,
  Image,
  List,
  Markdown,
  Menu,
  Navigation,
  NavigationStack,
  ScrollView,
  Section,
  Spacer,
  Text,
  Toolbar,
  ToolbarItem,
  VStack,
  useEffect,
  useMemo,
  useState,
} from "scripting"
import {
  actionsStatusForRun,
  downloadReleaseAsset,
  fetchPullRequestFiles,
  fetchRepositoryActionsRuns,
  fetchRepositoryBranches,
  fetchRepositoryCommits,
  fetchRepositoryContents,
  fetchRepositoryContentUpdatedAt,
  fetchRepositoryDefaultBranch,
  fetchRepositoryFile,
  fetchRepositoryPullRequests,
  fetchRepositoryReleases,
  githubBlobURL,
  githubRawURL,
  githubTreeURL,
  hasGitHubToken,
  invalidateRepositoryCache,
} from "./github-api"
import { ACCENT, DESIGN, errorStatusDetail, GITHUB_SYMBOL, GitHubIcon, GLASS, IconButton, openGitHubWebPage, relativeTime, StatusSurface } from "./glass-ui"
import type { BrowsableRepository, GitHubActionsRun, GitHubBranch, GitHubCommit, GitHubContentItem, GitHubPullRequest, GitHubPullRequestFile, GitHubRelease, GitHubReleaseAsset, GitHubRepository, LoadState } from "./types"

/** 只读页面只需要仓库标识。 */
export type RepositoryRef = Pick<GitHubRepository, "fullName" | "name"> & { owner: { login: string } }

/** 打开仓库文件浏览；列表数据缺默认分支时补一次请求。 */
export async function openRepositoryFiles(repository: GitHubRepository) {
  try {
    const defaultBranch = repository.defaultBranch ?? await fetchRepositoryDefaultBranch(repository.owner.login, repository.name)
    await Navigation.present(<NavigationStack><RepositoryFilesPage repository={{ ...repository, defaultBranch }} path="" /></NavigationStack>)
  } catch (caught) {
    await Dialog.alert({ title: "无法打开仓库", message: caught instanceof Error ? caught.message : "无法读取仓库默认分支。" })
  }
}

export async function openRepositoryReleases(repository: RepositoryRef) {
  await Navigation.present(<NavigationStack><RepositoryReleasesPage repository={repository} /></NavigationStack>)
}

export function RepositoryFilesPage({ repository, path, initialBranch, initialBranches }: { repository: BrowsableRepository; path: string; initialBranch?: string; initialBranches?: GitHubBranch[] }) {
  const dismiss = Navigation.useDismiss()
  const [items, setItems] = useState<GitHubContentItem[]>([])
  const [updatedAtByPath, setUpdatedAtByPath] = useState<Record<string, string | null>>({})
  const [branches, setBranches] = useState<GitHubBranch[]>(initialBranches ?? [])
  const [branchesState, setBranchesState] = useState<LoadState>(initialBranches ? "loaded" : "loading")
  const [branchesError, setBranchesError] = useState("")
  const [branch, setBranch] = useState(initialBranch ?? repository.defaultBranch)
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  async function load() {
    setState("loading")
    setError("")
    try {
      const loadedItems = await fetchRepositoryContents(repository.owner.login, repository.name, path, branch)
      setItems(loadedItems)
      setUpdatedAtByPath({})
      setState("loaded")
      // 每个条目一次请求；公共浏览（60 次/小时）改为在菜单中手动读取。
      if (hasGitHubToken()) void loadContentUpdatedAt(loadedItems)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取目录。")
      setState("error")
    }
  }

  async function loadContentUpdatedAt(loadedItems: GitHubContentItem[]) {
    const updatedEntries: Record<string, string | null> = {}
    for (let start = 0; start < loadedItems.length; start += 4) {
      const batch = loadedItems.slice(start, start + 4)
      const results = await Promise.all(batch.map(async item => {
        try {
          return [item.path, await fetchRepositoryContentUpdatedAt(repository.owner.login, repository.name, item.path, branch)] as const
        } catch {
          return [item.path, null] as const
        }
      }))
      for (const [itemPath, updatedAt] of results) updatedEntries[itemPath] = updatedAt
      setUpdatedAtByPath(current => ({ ...current, ...updatedEntries }))
    }
  }

  useEffect(() => { void load() }, [repository.fullName, path, branch])

  // 子目录沿用上级已读取的分支列表，不重复请求。
  useEffect(() => { if (!initialBranches) void refreshBranches(false) }, [repository.fullName])

  async function refreshBranches(showError = true): Promise<boolean> {
    setBranchesState("loading")
    setBranchesError("")
    try {
      // showError 为 true 即用户手动刷新，跳过公共缓存。
      setBranches(await fetchRepositoryBranches(repository.owner.login, repository.name, showError))
      setBranchesState("loaded")
      return true
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "无法读取分支列表。"
      setBranches([])
      setBranchesError(message)
      setBranchesState("error")
      if (showError) await Dialog.alert({ title: "刷新分支失败", message })
      return false
    }
  }

  const directoryTitle = path ? path.split("/").pop() ?? repository.name : repository.name
  const githubAppURL = `github://github.com/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}`
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleItems = items.filter(item => !normalizedQuery || item.name.toLocaleLowerCase().includes(normalizedQuery) || item.path.toLocaleLowerCase().includes(normalizedQuery))
  const currentDirectoryURL = path ? githubTreeURL(repository.owner.login, repository.name, branch, path) : null

  async function copyCurrentDirectoryGitHubLink() {
    if (!currentDirectoryURL) return
    await Pasteboard.setString(currentDirectoryURL)
    await Dialog.alert({ title: "GitHub 链接已复制", message: `已将 ${path} 的 GitHub 目录链接复制到剪贴板。` })
  }

  const directoryMenu = (
    <Menu label={<Image systemName="ellipsis.circle" foregroundStyle="label" frame={{ minWidth: 44, minHeight: 44 }} />}>
      {currentDirectoryURL ? <Button title="复制 GitHub 链接" systemImage="doc.on.doc" action={() => { void copyCurrentDirectoryGitHubLink() }} /> : null}
      <Button title="在 GitHub 客户端中打开" systemImage={GITHUB_SYMBOL} action={() => { void Safari.openURL(githubAppURL) }} />
      <Button title="在 Safari 中打开" systemImage="safari" action={() => { void openGitHubWebPage(currentDirectoryURL ?? repository.htmlUrl, repository.fullName) }} />
      {hasGitHubToken() || state !== "loaded" || items.length === 0 ? null : <Button title={`读取最后更新时间（${items.length} 次请求）`} systemImage="clock" action={() => { void loadContentUpdatedAt(items) }} />}
      <Button title="查看提交历史" systemImage="clock.arrow.circlepath" action={() => { void Navigation.present(<NavigationStack><RepositoryHistoryPage repository={repository} path={path} branch={branch} /></NavigationStack>) }} />
      <Button title="查看 Actions 运行" systemImage="checkmark.circle" action={() => { void Navigation.present(<NavigationStack><RepositoryActionsPage repository={repository} branch={branch} /></NavigationStack>) }} />
      <Button title="查看 Releases" systemImage="shippingbox" action={() => { void openRepositoryReleases(repository) }} />
      <Button title="查看开放 Pull Request" systemImage="arrow.triangle.pull" action={() => { void Navigation.present(<NavigationStack><RepositoryPullRequestsPage repository={repository} /></NavigationStack>) }} />
    </Menu>
  )

  return (
    <List
      listStyle="inset"
      refreshable={async () => { invalidateRepositoryCache(repository.fullName); await load() }}
      scrollContentBackground="hidden"
      scrollEdgeEffectHidden={{ edges: "top", hidden: true }}
      listRowBackground={<></>}
      listRowSeparator="hidden"
      navigationTitle={directoryTitle}
      navigationBarTitleDisplayMode="inline"
      searchable={{ value: searchQuery, onChanged: setSearchQuery, placement: "toolbar", prompt: "搜索当前目录文件" }}
      searchToolbarBehavior="minimize"
      toolbar={<Toolbar>{path ? null : <ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem>}<ToolbarItem placement="topBarTrailing">{directoryMenu}</ToolbarItem></Toolbar>}
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          <HStack spacing={8} padding={{ horizontal: 8, vertical: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <Text font={12} foregroundStyle="secondaryLabel" lineLimit={1}>{path ? `${repository.fullName}/${path}` : repository.fullName}</Text>
            <Spacer />
            <Menu label={<Text font={12} fontWeight="medium" foregroundStyle={ACCENT}>分支：{branch}</Text>}>
              <Button title={branchesState === "loading" ? "正在读取分支" : "刷新分支列表"} systemImage={branchesState === "loading" ? "hourglass" : "arrow.clockwise"} action={branchesState === "loading" ? () => {} : () => { void refreshBranches() }} />
              {branchesState === "loaded" ? branches.map(candidate => <Button key={candidate.name} title={`${candidate.name}${candidate.protected ? " · 受保护" : ""}${candidate.name === repository.defaultBranch ? " · 默认" : ""}`} systemImage={candidate.name === branch ? "checkmark" : "arrow.triangle.branch"} action={() => setBranch(candidate.name)} />) : null}
            </Menu>
          </HStack>
          {branchesState === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取分支列表" detail={errorStatusDetail(branchesError, `当前正在浏览 ${branch} 分支，可稍后重新读取分支列表以切换分支。`)} action={() => { void refreshBranches() }} /> : null}
          {state === "loading" && items.length > 0 ? <HStack spacing={7} padding={{ horizontal: 8, vertical: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }}><Image systemName="arrow.triangle.2.circlepath" font={12} foregroundStyle="secondaryLabel" /><Text font={12} foregroundStyle="secondaryLabel">正在刷新当前分支目录</Text></HStack> : null}
          {state === "loading" && items.length === 0 ? <StatusSurface icon="folder" title="正在读取目录" detail="正在同步 GitHub 中的文件列表。" loading /> : null}
          {state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取目录" detail={errorStatusDetail(error)} action={() => { void load() }} /> : null}
          {state === "loaded" && items.length === 0 ? <StatusSurface icon="folder" title="目录为空" detail="当前目录没有文件。" /> : null}
          {state === "loaded" && items.length > 0 && visibleItems.length === 0 ? <StatusSurface icon="magnifyingglass" title="没有匹配文件" detail="换一个文件名或路径关键词。" /> : null}
          {visibleItems.map(item => item.type === "dir" ? <DirectoryRow key={item.path} item={item} repository={repository} branch={branch} branches={branchesState === "loaded" ? branches : undefined} updatedAt={updatedAtByPath[item.path]} /> : <FileRow key={item.path} item={item} repository={repository} branch={branch} updatedAt={updatedAtByPath[item.path]} />)}
        </VStack>
      </Section>
    </List>
  )
}

function DirectoryRow({ item, repository, branch, branches, updatedAt }: { item: GitHubContentItem; repository: BrowsableRepository; branch: string; branches?: GitHubBranch[]; updatedAt: string | null | undefined }) {
  const [isPresented, setIsPresented] = useState(false)
  return <Button action={() => setIsPresented(true)} accessibilityLabel={`打开目录 ${item.name}`} navigationDestination={{ content: <RepositoryFilesPage repository={repository} path={item.path} initialBranch={branch} initialBranches={branches} />, isPresented, onChanged: setIsPresented }} buttonStyle="plain" frame={{ maxWidth: "infinity", minHeight: 52 }} contentShape={{ type: "rect", cornerRadius: DESIGN.rowRadius, style: "continuous" }} glassEffect={GLASS.interactive} glassEffectTransition="materialize"><HStack spacing={12} padding={14} frame={{ maxWidth: "infinity", minHeight: 52 }} fixedSize={{ horizontal: false, vertical: true }}><Image systemName="folder.fill" foregroundStyle={ACCENT} frame={{ width: 22 }} /><VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity" }}><Text font={15} fontWeight="medium" lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.name}</Text>{updatedAt === undefined ? null : <Text font={12} foregroundStyle="secondaryLabel">{contentUpdatedAtLabel(updatedAt)}</Text>}</VStack><Image systemName="chevron.right" font={12} fontWeight="semibold" foregroundStyle="tertiaryLabel" /></HStack></Button>
}

/** 轻点预览，长按显示更多操作。 */
function FileRow({ item, repository, branch, updatedAt }: { item: GitHubContentItem; repository: BrowsableRepository; branch: string; updatedAt: string | null | undefined }) {
  const blobURL = githubBlobURL(repository.owner.login, repository.name, branch, item.path)
  const rawURL = item.downloadUrl ?? githubRawURL(repository.owner.login, repository.name, branch, item.path)
  function presentViewer() {
    void Navigation.present(<NavigationStack><RepositoryFileViewerPage repository={repository} item={item} branch={branch} /></NavigationStack>)
  }
  async function copyLink(url: string, kind: "Raw" | "GitHub") {
    await Pasteboard.setString(url)
    await Dialog.alert({ title: `${kind} 链接已复制`, message: `已将 ${item.name} 的 ${kind} 链接复制到剪贴板。` })
  }
  return <Menu primaryAction={presentViewer} frame={{ maxWidth: "infinity", minHeight: 52 }} contentShape={{ type: "rect", cornerRadius: DESIGN.rowRadius, style: "continuous" }} menuIndicator="hidden" menuStyle="button" buttonStyle="plain" glassEffect={GLASS.interactive} glassEffectTransition="materialize" label={<HStack spacing={12} padding={14} frame={{ maxWidth: "infinity", minHeight: 52 }} fixedSize={{ horizontal: false, vertical: true }}><Image systemName={fileIcon(item.name)} foregroundStyle="secondaryLabel" frame={{ width: 22 }} /><VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity" }}><Text font={15} fontWeight="medium" lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.name}</Text><Text font={12} foregroundStyle="secondaryLabel">{[formatBytes(item.size), contentUpdatedAtLabel(updatedAt)].filter(Boolean).join(" · ")}</Text></VStack><Image systemName="eye" font={13} foregroundStyle="tertiaryLabel" /></HStack>}><Button title="预览文件" systemImage="eye" action={presentViewer} /><Button title="查看文件历史" systemImage="clock.arrow.circlepath" action={() => { void Navigation.present(<NavigationStack><RepositoryHistoryPage repository={repository} path={item.path} branch={branch} /></NavigationStack>) }} /><Button title="复制 Raw 链接" systemImage="link" action={() => { void copyLink(rawURL, "Raw") }} /><Button title="复制 GitHub 链接" systemImage="doc.on.doc" action={() => { void copyLink(blobURL, "GitHub") }} /><Button title="在 Safari 中打开" systemImage="safari" action={() => { void openGitHubWebPage(blobURL, item.name) }} /></Menu>
}

const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp|heic|bmp)$/i
const MARKDOWN_FILE_PATTERN = /\.(md|markdown|mdx)$/i

function fileIcon(name: string): string {
  if (IMAGE_FILE_PATTERN.test(name)) return "photo"
  if (MARKDOWN_FILE_PATTERN.test(name)) return "doc.richtext"
  return "doc.text"
}

/** Editor 只支持少数高亮类型，其余按纯文本显示。 */
function editorExtension(name: string): "tsx" | "ts" | "js" | "jsx" | "txt" | "md" | "css" | "html" | "json" {
  const extension = name.split(".").pop()?.toLocaleLowerCase() ?? ""
  if (extension === "tsx" || extension === "ts" || extension === "jsx" || extension === "css" || extension === "json") return extension
  if (extension === "js" || extension === "mjs" || extension === "cjs") return "js"
  if (extension === "html" || extension === "htm") return "html"
  if (MARKDOWN_FILE_PATTERN.test(name)) return "md"
  return "txt"
}

/** 只读预览：Markdown 渲染、代码只读高亮（可搜索、导出）、图片直接显示。 */
function RepositoryFileViewerPage({ repository, item, branch }: { repository: BrowsableRepository; item: GitHubContentItem; branch: string }) {
  const dismiss = Navigation.useDismiss()
  const isImage = IMAGE_FILE_PATTERN.test(item.name)
  const isMarkdown = MARKDOWN_FILE_PATTERN.test(item.name)
  const [content, setContent] = useState<string | null>(null)
  const [state, setState] = useState<LoadState>(isImage ? "loaded" : "loading")
  const [error, setError] = useState("")
  const [showsSource, setShowsSource] = useState(!isMarkdown)
  const rawURL = item.downloadUrl ?? githubRawURL(repository.owner.login, repository.name, branch, item.path)
  const blobURL = githubBlobURL(repository.owner.login, repository.name, branch, item.path)
  const controller = useMemo(() => content === null ? null : new EditorController({ content, ext: editorExtension(item.name), readOnly: true }), [content])

  useEffect(() => () => { controller?.dispose() }, [controller])

  async function load() {
    if (isImage) return
    setState("loading")
    setError("")
    try {
      setContent(await fetchRepositoryFile(repository.owner.login, repository.name, item.path, branch))
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取文件。")
      setState("error")
    }
  }

  useEffect(() => { void load() }, [repository.fullName, item.path, branch])

  async function copyContent() {
    if (content === null) return
    await Pasteboard.setString(content)
    await Dialog.alert({ title: "已复制", message: `已将 ${item.name} 的全部内容复制到剪贴板。` })
  }

  async function copyRawLink() {
    await Pasteboard.setString(rawURL)
    await Dialog.alert({ title: "Raw 链接已复制", message: `已将 ${item.name} 的 Raw 链接复制到剪贴板。` })
  }

  const toolbar = (
    <Toolbar>
      <ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem>
      <ToolbarItem placement="topBarTrailing">
        <Menu label={<Image systemName="ellipsis.circle" foregroundStyle="label" frame={{ minWidth: 44, minHeight: 44 }} />}>
          {isMarkdown && content !== null ? <Button title={showsSource ? "渲染 Markdown" : "显示源码"} systemImage={showsSource ? "doc.richtext" : "chevron.left.forwardslash.chevron.right"} action={() => setShowsSource(!showsSource)} /> : null}
          {content !== null ? <Button title="复制全部内容" systemImage="doc.on.clipboard" action={() => { void copyContent() }} /> : null}
          <Button title="复制 Raw 链接" systemImage="link" action={() => { void copyRawLink() }} />
          <Button title="查看文件历史" systemImage="clock.arrow.circlepath" action={() => { void Navigation.present(<NavigationStack><RepositoryHistoryPage repository={repository} path={item.path} branch={branch} /></NavigationStack>) }} />
          <Button title="在 Safari 中打开" systemImage="safari" action={() => { void openGitHubWebPage(blobURL, item.name) }} />
          {isImage ? null : <Button title="重新读取" systemImage="arrow.clockwise" action={() => { void load() }} />}
        </Menu>
      </ToolbarItem>
    </Toolbar>
  )

  return (
    <VStack spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="systemGroupedBackground" navigationTitle={item.name} navigationBarTitleDisplayMode="inline" toolbar={toolbar}>
      {state === "loading" ? <VStack padding={16}><StatusSurface icon="doc.text" title="正在读取文件" detail={`${item.path} · ${branch}`} loading /></VStack> : null}
      {state === "error" ? <VStack padding={16}><StatusSurface icon="exclamationmark.triangle.fill" title="无法预览文件" detail={errorStatusDetail(error, "可在右上角菜单中用 Safari 打开。")} action={() => { void load() }} /></VStack> : null}
      {isImage ? <ScrollView frame={{ maxWidth: "infinity", maxHeight: "infinity" }}><Image imageUrl={rawURL} resizable={true} aspectRatio={{ contentMode: "fit" }} frame={{ maxWidth: "infinity" }} padding={16} /></ScrollView> : null}
      {state === "loaded" && content !== null && !showsSource ? <Markdown content={content} theme="github" useDefaultHighlighterTheme={true} /> : null}
      {state === "loaded" && controller && showsSource ? <Editor controller={controller} searchEnabled={true} exportEnabled={true} /> : null}
      {state === "loaded" || state === "error" ? null : <Spacer />}
    </VStack>
  )
}

function RepositoryHistoryPage({ repository, path, branch }: { repository: RepositoryRef; path: string; branch: string }) {
  const dismiss = Navigation.useDismiss()
  const [commits, setCommits] = useState<GitHubCommit[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")

  async function load() {
    setState("loading")
    setError("")
    try {
      setCommits(await fetchRepositoryCommits(repository.owner.login, repository.name, path, branch))
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取提交历史。")
      setState("error")
    }
  }

  useEffect(() => { void load() }, [repository.fullName, path, branch])
  const title = path ? `${path.split("/").pop() ?? "文件"} 历史` : "提交历史"
  return <List background="systemGroupedBackground" listStyle="inset" refreshable={async () => { invalidateRepositoryCache(repository.fullName); await load() }} scrollContentBackground="hidden" scrollEdgeEffectHidden={{ edges: "top", hidden: true }} listRowBackground={<></>} listRowSeparator="hidden" navigationTitle={title} navigationBarTitleDisplayMode="inline" toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem></Toolbar>}><Section listRowBackground={<></>} listRowSeparator="hidden"><VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden"><HStack spacing={12} padding={{ horizontal: 14, vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}><Image systemName="clock.arrow.circlepath" foregroundStyle={ACCENT} frame={{ width: 22, alignment: "center" }} /><Text font={13} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }}>{path || `${branch} 分支最新提交`}</Text></HStack>{state === "loading" && commits.length === 0 ? <StatusSurface icon="clock.arrow.circlepath" title="正在读取历史" detail="正在加载最近 30 条提交记录。" loading /> : null}{state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取历史" detail={errorStatusDetail(error)} action={() => { void load() }} /> : null}{state === "loaded" && commits.length === 0 ? <StatusSurface icon="clock.badge.xmark" title="没有提交记录" detail="GitHub 没有返回符合当前范围的提交。" /> : null}{commits.map(commit => <Button key={commit.sha} action={() => { void openGitHubWebPage(commit.htmlUrl, "提交历史") }} accessibilityLabel={`打开提交 ${commit.sha.slice(0, 7)}`} buttonStyle="plain" padding={14} frame={{ maxWidth: "infinity", minHeight: 52 }} fixedSize={{ horizontal: false, vertical: true }} glassEffect={GLASS.interactive}><HStack spacing={12} alignment="center" frame={{ maxWidth: "infinity" }}><Image systemName="arrow.triangle.branch" foregroundStyle={ACCENT} frame={{ width: 22 }} /><VStack spacing={4} alignment="leading" frame={{ maxWidth: "infinity" }}><Text font={15} fontWeight="medium" lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>{commit.message}</Text><Text font={12} foregroundStyle="secondaryLabel">{commit.authorName} · {formatCommitDate(commit.authorDate)} · {commit.sha.slice(0, 7)}</Text></VStack><Image systemName="safari" foregroundStyle="secondaryLabel" /></HStack></Button>)}</VStack></Section></List>
}

export function RepositoryReleasesPage({ repository }: { repository: RepositoryRef }) {
  const dismiss = Navigation.useDismiss()
  const [releases, setReleases] = useState<GitHubRelease[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  const [downloadingAssetKey, setDownloadingAssetKey] = useState<string | null>(null)

  async function load() {
    setState("loading")
    setError("")
    try {
      setReleases(await fetchRepositoryReleases(repository.owner.login, repository.name))
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取 Release。")
      setState("error")
    }
  }

  async function downloadAsset(release: GitHubRelease, asset: GitHubReleaseAsset) {
    const assetKey = `${release.id}:${asset.id}`
    if (downloadingAssetKey !== null) return
    const directory = `${FileManager.documentsDirectory}/GitHub Releases/${safeFileName(repository.fullName)}/${safeFileName(release.tagName)}`
    const targetPath = `${directory}/${safeFileName(asset.name)}`
    if (await FileManager.exists(targetPath) && !await Dialog.confirm({ title: "文件已存在", message: `${asset.name}（${release.tagName}）已下载。确定覆盖本地文件吗？`, confirmLabel: "覆盖", cancelLabel: "取消" })) return
    setDownloadingAssetKey(assetKey)
    try {
      await FileManager.createDirectory(directory, true)
      const data = await downloadReleaseAsset(asset)
      await FileManager.writeAsData(targetPath, data)
      const openFolder = await Dialog.confirm({ title: "下载完成", message: `${asset.name}\n版本：${release.tagName}\n已保存到下载文件夹，也可从 Releases 页顶部打开。`, confirmLabel: "打开下载文件夹", cancelLabel: "完成" })
      if (openFolder) void openReleaseDownloads()
    } catch (caught) {
      await Dialog.alert({ title: "下载失败", message: caught instanceof Error ? caught.message : "Release 资产未能保存。" })
    } finally {
      setDownloadingAssetKey(null)
    }
  }

  useEffect(() => { void load() }, [repository.fullName])

  return <List background="systemGroupedBackground" listStyle="inset" refreshable={async () => { invalidateRepositoryCache(repository.fullName); await load() }} scrollContentBackground="hidden" scrollEdgeEffectHidden={{ edges: "top", hidden: true }} listRowBackground={<></>} listRowSeparator="hidden" navigationTitle="Releases" navigationBarTitleDisplayMode="inline" toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem><ToolbarItem placement="topBarTrailing"><Menu label={<Image systemName="folder" foregroundStyle="label" frame={{ minWidth: DESIGN.touch, minHeight: DESIGN.touch }} accessibilityLabel="Release 操作" />}><Button title="打开下载文件夹" systemImage="folder" action={() => { void openReleaseDownloads() }} /><Button title="刷新 Releases" systemImage="arrow.clockwise" action={() => { void load() }} /></Menu></ToolbarItem></Toolbar>}><Section listRowBackground={<></>} listRowSeparator="hidden"><VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden"><HStack spacing={8} padding={{ horizontal: 14, vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}><Image systemName="shippingbox.fill" font={18} foregroundStyle={ACCENT} frame={{ width: 42 }} /><VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={13} fontWeight="medium">{repository.fullName}</Text><Text font={12} foregroundStyle="secondaryLabel">{state === "loaded" ? `${releases.length} 个 Release` : "从 GitHub 读取版本发布"}</Text></VStack></HStack>{state === "loading" && releases.length === 0 ? <StatusSurface icon="shippingbox" title="正在读取 Releases" detail="正在从 GitHub 加载版本和可下载资产。" loading /> : null}{state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取 Releases" detail={errorStatusDetail(error)} action={() => { void load() }} /> : null}{state === "loaded" && releases.length === 0 ? <StatusSurface icon="shippingbox" title="没有 Release" detail="该仓库还没有发布版本。" /> : null}{releases.map(release => <ReleaseRow key={String(release.id)} release={release} downloadingAssetKey={downloadingAssetKey} onDownload={(asset) => { void downloadAsset(release, asset) }} />)}</VStack></Section></List>
}

function ReleaseRow({ release, downloadingAssetKey, onDownload }: { release: GitHubRelease; downloadingAssetKey: string | null; onDownload: (asset: GitHubReleaseAsset) => void }) {
  const statusText = release.isDraft ? "草稿" : release.isPrerelease ? "预发布" : "正式版"
  const isDownloading = downloadingAssetKey?.startsWith(`${release.id}:`) ?? false
  return <VStack spacing={12} alignment="leading" padding={DESIGN.inset} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
    <HStack spacing={10} alignment="top" frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Image systemName={release.isPrerelease ? "flask.fill" : "shippingbox.fill"} foregroundStyle={release.isPrerelease ? "systemOrange" : ACCENT} frame={{ width: DESIGN.iconSlot, height: DESIGN.touch, alignment: "center" }} accessibilityLabel={statusText} />
      <VStack spacing={4} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={17} fontWeight="semibold" frame={{ maxWidth: "infinity", alignment: "leading" }} multilineTextAlignment="leading">{release.name || release.tagName}</Text>
        <Text font={12} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }} multilineTextAlignment="leading">{release.tagName} · {formatCommitDate(release.publishedAt ?? release.createdAt)} · {statusText}</Text>
      </VStack>
    </HStack>
    <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      {release.assets.length > 0 ? <Menu disabled={isDownloading} frame={{ maxWidth: "infinity", minHeight: DESIGN.touch }} contentShape="capsule" menuIndicator="hidden" menuStyle="button" buttonStyle="plain" glassEffect={GLASS.interactiveCapsule} glassEffectTransition="materialize" label={<HStack spacing={6} padding={{ horizontal: 10, vertical: 6 }} frame={{ maxWidth: "infinity", minHeight: DESIGN.touch, alignment: "center" }}><Image systemName={isDownloading ? "hourglass" : "arrow.down.circle"} foregroundStyle={isDownloading ? "systemOrange" : ACCENT} /><Text font={13} fontWeight="medium">{isDownloading ? "正在下载" : `下载资产 (${release.assets.length})`}</Text></HStack>}>
        {release.assets.map(asset => <Button key={String(asset.id)} title={`${asset.name} · ${formatBytes(asset.size)}`} systemImage="arrow.down.circle" action={() => onDownload(asset)} />)}
      </Menu> : <HStack padding={{ horizontal: 10, vertical: 6 }} frame={{ maxWidth: "infinity", minHeight: DESIGN.touch, alignment: "center" }} glassEffect={GLASS.content}><Text font={12} foregroundStyle="tertiaryLabel">无可下载资产</Text></HStack>}
      <Menu frame={{ maxWidth: "infinity", minHeight: DESIGN.touch }} contentShape="capsule" menuIndicator="hidden" menuStyle="button" buttonStyle="plain" glassEffect={GLASS.interactiveCapsule} glassEffectTransition="materialize" label={<HStack spacing={6} padding={{ horizontal: 10, vertical: 6 }} frame={{ maxWidth: "infinity", minHeight: DESIGN.touch, alignment: "center" }} accessibilityLabel={`${release.tagName} 操作`}><GitHubIcon size={16} /><Text font={13} fontWeight="medium">GitHub</Text></HStack>}>
        <Button title="跳转 GitHub" systemImage={GITHUB_SYMBOL} action={() => { void Safari.openURL(release.htmlUrl) }} />
      </Menu>
    </HStack>
  </VStack>
}

type ReleaseDownloadFile = {
  path: string
  name: string
  size: number
  modifiedAt: number
}

/** Releases 页顶部、设置页工具、下载完成提示共用的下载文件夹入口。 */
export async function openReleaseDownloads() {
  await Navigation.present(<NavigationStack><ReleaseDownloadsPage /></NavigationStack>)
}

function ReleaseDownloadsPage() {
  const dismiss = Navigation.useDismiss()
  const [files, setFiles] = useState<ReleaseDownloadFile[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  const downloadsDirectory = `${FileManager.documentsDirectory}/GitHub Releases`

  async function scanDirectory(directory: string): Promise<ReleaseDownloadFile[]> {
    const children = await FileManager.readDirectory(directory, false)
    const result: ReleaseDownloadFile[] = []
    for (const child of children) {
      const path = child.startsWith("/") ? child : `${directory}/${child}`
      if (await FileManager.isDirectory(path)) {
        result.push(...await scanDirectory(path))
      } else if (await FileManager.isFile(path)) {
        const stat = await FileManager.stat(path)
        result.push({ path, name: path.split("/").pop() ?? "未命名文件", size: stat.size, modifiedAt: stat.modificationDate })
      }
    }
    return result
  }

  async function load() {
    setState("loading")
    setError("")
    try {
      await FileManager.createDirectory(downloadsDirectory, true)
      setFiles((await scanDirectory(downloadsDirectory)).sort((left, right) => right.modifiedAt - left.modifiedAt))
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取下载文件夹。")
      setState("error")
    }
  }

  async function openFile(file: ReleaseDownloadFile) {
    try {
      await DocumentInteraction.openInMenu(file.path)
    } catch (caught) {
      await Dialog.alert({ title: "无法打开文件", message: caught instanceof Error ? caught.message : "当前没有支持此文件的 App。" })
    }
  }

  async function shareFile(file: ReleaseDownloadFile) {
    await ShareSheet.present([file.path])
  }

  async function renameFile(file: ReleaseDownloadFile) {
    const nextName = (await Dialog.prompt(`重命名文件\n${file.name}`))?.trim()
    if (!nextName || nextName === file.name || nextName.includes("/") || nextName.includes("\\")) return
    try {
      await FileManager.rename(file.path, `${file.path.slice(0, file.path.lastIndexOf("/") + 1)}${nextName}`)
      await load()
    } catch (caught) {
      await Dialog.alert({ title: "重命名失败", message: caught instanceof Error ? caught.message : "文件未能重命名。" })
    }
  }

  async function deleteFile(file: ReleaseDownloadFile) {
    if (!await Dialog.confirm({ title: "删除下载文件", message: `确定删除 ${file.name} 吗？`, confirmLabel: "删除", cancelLabel: "取消" })) return
    try {
      await FileManager.remove(file.path)
      await load()
    } catch (caught) {
      await Dialog.alert({ title: "删除失败", message: caught instanceof Error ? caught.message : "文件未能删除。" })
    }
  }

  useEffect(() => { void load() }, [])

  return <List background="systemGroupedBackground" listStyle="inset" refreshable={load} scrollContentBackground="hidden" scrollEdgeEffectHidden={{ edges: "top", hidden: true }} listRowBackground={<></>} listRowSeparator="hidden" navigationTitle="下载文件夹" navigationBarTitleDisplayMode="inline" toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem><ToolbarItem placement="topBarTrailing"><IconButton icon="arrow.clockwise" label="刷新下载文件夹" action={() => { void load() }} /></ToolbarItem></Toolbar>}><Section listRowBackground={<></>} listRowSeparator="hidden"><VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden"><HStack spacing={8} padding={{ horizontal: 14, vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}><Image systemName="folder.fill" font={18} foregroundStyle={ACCENT} frame={{ width: 42 }} /><VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={13} fontWeight="medium">GitHub Releases</Text><Text font={12} foregroundStyle="secondaryLabel">{state === "loaded" ? `${files.length} 个本地文件` : "Documents/GitHub Releases"}</Text></VStack></HStack>{state === "loading" && files.length === 0 ? <StatusSurface icon="folder" title="正在读取下载文件夹" detail="正在加载已保存的 Release 资产。" loading /> : null}{state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取下载文件夹" detail={errorStatusDetail(error, "请确认 Documents 目录可用后重试。")} action={() => { void load() }} /> : null}{state === "loaded" && files.length === 0 ? <StatusSurface icon="tray" title="下载文件夹为空" detail="下载 Release 资产后，会在这里按仓库与版本显示。" /> : null}{files.map(file => <Menu key={file.path} frame={{ maxWidth: "infinity", minHeight: 58 }} contentShape={{ type: "rect", cornerRadius: DESIGN.rowRadius, style: "continuous" }} menuIndicator="hidden" menuStyle="button" buttonStyle="plain" glassEffect={GLASS.interactive} glassEffectTransition="materialize" label={<HStack spacing={10} padding={12} frame={{ maxWidth: "infinity", minHeight: 58, alignment: "leading" }}><Image systemName="doc.fill" foregroundStyle={ACCENT} frame={{ width: DESIGN.iconSlot, alignment: "center" }} /><VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={14} fontWeight="medium" lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>{file.name}</Text><Text font={11} foregroundStyle="secondaryLabel">{formatBytes(file.size)} · {formatCommitDate(new Date(file.modifiedAt).toISOString())}</Text></VStack><Image systemName="ellipsis.circle" foregroundStyle="tertiaryLabel" frame={{ width: DESIGN.iconSlot, alignment: "center" }} /></HStack>}><Button title="打开文件" systemImage="arrow.up.forward.app" action={() => { void openFile(file) }} /><Button title="分享文件" systemImage="square.and.arrow.up" action={() => { void shareFile(file) }} /><Button title="重命名文件" systemImage="pencil" action={() => { void renameFile(file) }} /><Button title="删除文件" systemImage="trash" role="destructive" action={() => { void deleteFile(file) }} /></Menu>)}</VStack></Section></List>
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "未命名文件"
}

export function RepositoryActionsPage({ repository, branch }: { repository: RepositoryRef; branch?: string }) {
  const dismiss = Navigation.useDismiss()
  const [runs, setRuns] = useState<GitHubActionsRun[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  async function load() {
    setState("loading")
    setError("")
    try {
      setRuns(await fetchRepositoryActionsRuns(repository.owner.login, repository.name, branch))
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取 Actions 运行记录。")
      setState("error")
    }
  }
  useEffect(() => { void load() }, [repository.fullName, branch])
  return <List background="systemGroupedBackground" listStyle="inset" refreshable={load} scrollContentBackground="hidden" scrollEdgeEffectHidden={{ edges: "top", hidden: true }} listRowBackground={<></>} listRowSeparator="hidden" navigationTitle="Actions 运行" navigationBarTitleDisplayMode="inline" toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem></Toolbar>}><Section listRowBackground={<></>} listRowSeparator="hidden"><VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden"><HStack spacing={8} padding={{ horizontal: 14, vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}><Image systemName="checkmark.circle" font={18} foregroundStyle={ACCENT} frame={{ width: 42 }} /><VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={13} fontWeight="medium" frame={{ maxWidth: "infinity", alignment: "leading" }}>最近 Actions 运行</Text><Text font={12} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }}>{branch ? `分支：${branch} · 最近 30 条` : "全部分支 · 最近 30 条"}</Text></VStack></HStack>{state === "loading" && runs.length === 0 ? <StatusSurface icon="checkmark.circle" title="正在读取运行记录" detail="正在同步 GitHub Actions 的最近运行。" loading /> : null}{state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取运行记录" detail={errorStatusDetail(error)} action={() => { void load() }} /> : null}{state === "loaded" && runs.length === 0 ? <StatusSurface icon="gearshape" title="没有运行记录" detail="当前分支还没有可显示的 Actions 运行。" /> : null}{runs.map(run => <Button key={String(run.id)} action={() => { void openGitHubWebPage(run.htmlUrl, "Actions") }} accessibilityLabel={`打开 Actions 运行 ${run.runNumber}`} buttonStyle="plain" padding={14} frame={{ maxWidth: "infinity", minHeight: 64 }} fixedSize={{ horizontal: false, vertical: true }} glassEffect={GLASS.interactive}><HStack spacing={8} alignment="center" frame={{ maxWidth: "infinity" }}><Image systemName={actionsStatusForRun(run).icon} font={18} foregroundStyle={actionsStatusForRun(run).color} frame={{ width: 42 }} /><VStack spacing={4} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={15} fontWeight="medium" lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{`${run.workflowName} · #${run.runNumber}`}</Text><Text font={12} foregroundStyle="secondaryLabel" lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{`${actionsStatusForRun(run).label} · ${run.event}${run.branch ? ` · ${run.branch}` : ""}${run.updatedAt ? ` · ${relativeTime(run.updatedAt)}` : ""}`}</Text></VStack><Image systemName="arrow.up.right" foregroundStyle="tertiaryLabel" /></HStack></Button>)}</VStack></Section></List>
}

/** undefined 表示未读取（公共浏览需手动读取），不显示；null 表示无提交记录。 */
function contentUpdatedAtLabel(updatedAt: string | null | undefined): string {
  if (updatedAt === undefined) return ""
  return updatedAt ? `最后更新：${relativeTime(updatedAt)}` : "最后更新：暂无记录"
}


function RepositoryPullRequestsPage({ repository }: { repository: RepositoryRef }) {
  const dismiss = Navigation.useDismiss()
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceBranch, setSourceBranch] = useState("all")
  async function load() {
    setState("loading")
    setError("")
    try {
      setPullRequests(await fetchRepositoryPullRequests(repository.owner.login, repository.name))
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取 Pull Request。")
      setState("error")
    }
  }
  useEffect(() => { void load() }, [repository.fullName])
  const sourceBranches = Array.from(new Set(pullRequests.map(pullRequest => pullRequest.headBranch))).sort((left, right) => left.localeCompare(right))
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visiblePullRequests = pullRequests.filter(pullRequest => {
    const matchesBranch = sourceBranch === "all" || pullRequest.headBranch === sourceBranch
    const matchesQuery = !normalizedQuery || pullRequest.title.toLocaleLowerCase().includes(normalizedQuery) || pullRequest.headBranch.toLocaleLowerCase().includes(normalizedQuery) || pullRequest.baseBranch.toLocaleLowerCase().includes(normalizedQuery)
    return matchesBranch && matchesQuery
  })
  return <List background="systemGroupedBackground" listStyle="inset" refreshable={load} scrollContentBackground="hidden" scrollEdgeEffectHidden={{ edges: "top", hidden: true }} listRowBackground={<></>} listRowSeparator="hidden" navigationTitle="Pull Requests" navigationBarTitleDisplayMode="inline" searchable={{ value: searchQuery, onChanged: setSearchQuery, placement: "toolbar", prompt: "搜索标题或分支" }} searchToolbarBehavior="minimize" toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem><ToolbarItem placement="topBarTrailing"><Menu label={<Image systemName="ellipsis.circle" frame={{ minWidth: 44, minHeight: 44 }} />}><Button title="刷新 Pull Request" systemImage="arrow.clockwise" action={() => { void load() }} /></Menu></ToolbarItem></Toolbar>}><Section listRowBackground={<></>} listRowSeparator="hidden"><VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden"><HStack spacing={8} padding={{ horizontal: 14, vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}><Image systemName="arrow.triangle.pull" font={18} foregroundStyle={ACCENT} frame={{ width: 42 }} /><VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={13} fontWeight="medium" frame={{ maxWidth: "infinity", alignment: "leading" }}>开放 Pull Request</Text><Text font={12} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }}>来源分支：{sourceBranch === "all" ? "全部" : sourceBranch} · 已加载全部 {pullRequests.length} 个开放请求</Text></VStack></HStack><HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}><Menu label={<Text font={12} fontWeight="medium" foregroundStyle={ACCENT}>来源：{sourceBranch === "all" ? "全部" : sourceBranch}</Text>}><Button title="全部来源分支" action={() => setSourceBranch("all")} />{sourceBranches.map(candidate => <Button key={candidate} title={candidate} action={() => setSourceBranch(candidate)} />)}</Menu><Text font={12} foregroundStyle="secondaryLabel">{visiblePullRequests.length} 项</Text></HStack>{state === "loading" && pullRequests.length === 0 ? <StatusSurface icon="arrow.triangle.pull" title="正在读取 Pull Request" detail="正在分页同步当前仓库的全部开放合并请求。" loading /> : null}{state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取 Pull Request" detail={errorStatusDetail(error)} action={() => { void load() }} /> : null}{state === "loaded" && pullRequests.length === 0 ? <StatusSurface icon="checkmark.circle" title="没有开放的 Pull Request" detail="该仓库当前没有开放的合并请求。" /> : null}{state === "loaded" && pullRequests.length > 0 && visiblePullRequests.length === 0 ? <StatusSurface icon="line.3.horizontal.decrease.circle" title="没有匹配的 Pull Request" detail={`当前已加载 ${pullRequests.length} 个开放请求；尝试更换搜索关键词或来源分支。`} /> : null}{visiblePullRequests.map(pullRequest => <Button key={String(pullRequest.number)} action={() => { void Navigation.present(<NavigationStack><PullRequestDetailPage repository={repository} pullRequest={pullRequest} /></NavigationStack>) }} accessibilityLabel={`查看 Pull Request ${pullRequest.number}`} buttonStyle="plain" padding={14} frame={{ maxWidth: "infinity", minHeight: 64 }} fixedSize={{ horizontal: false, vertical: true }} glassEffect={GLASS.interactive}><HStack spacing={8} alignment="center" frame={{ maxWidth: "infinity" }}><Image systemName={pullRequest.draft ? "doc.badge.ellipsis" : "arrow.triangle.pull"} font={18} foregroundStyle={pullRequest.draft ? "systemOrange" : "systemGreen"} frame={{ width: 42 }} /><VStack spacing={4} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={15} fontWeight="medium" lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>{`#${pullRequest.number} ${pullRequest.title}`}</Text><Text font={12} foregroundStyle="secondaryLabel" lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{`${pullRequest.headBranch} → ${pullRequest.baseBranch} · ${pullRequest.authorName}${pullRequest.draft ? " · 草稿" : ""}`}</Text></VStack><Image systemName="arrow.up.right" foregroundStyle="tertiaryLabel" /></HStack></Button>)}</VStack></Section></List>

}

function PullRequestDetailPage({ repository, pullRequest }: { repository: RepositoryRef; pullRequest: GitHubPullRequest }) {
  const dismiss = Navigation.useDismiss()
  const [files, setFiles] = useState<GitHubPullRequestFile[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [error, setError] = useState("")
  async function loadFiles() {
    setState("loading")
    setError("")
    try {
      setFiles(await fetchPullRequestFiles(repository.owner.login, repository.name, pullRequest.number))
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取变更文件。")
      setState("error")
    }
  }
  useEffect(() => { void loadFiles() }, [repository.fullName, pullRequest.number])
  const additions = files.reduce((total, file) => total + file.additions, 0)
  const deletions = files.reduce((total, file) => total + file.deletions, 0)
  return <List background="systemGroupedBackground" listStyle="inset" refreshable={loadFiles} scrollContentBackground="hidden" scrollEdgeEffectHidden={{ edges: "top", hidden: true }} listRowBackground={<></>} listRowSeparator="hidden" navigationTitle={`PR #${pullRequest.number}`} navigationBarTitleDisplayMode="inline" toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem><ToolbarItem placement="topBarTrailing"><Menu label={<Image systemName="ellipsis.circle" frame={{ minWidth: 44, minHeight: 44 }} />}><Button title="在 GitHub 中打开" systemImage={GITHUB_SYMBOL} action={() => { void openGitHubWebPage(pullRequest.htmlUrl, `PR #${pullRequest.number}`) }} /><Button title="刷新变更文件" systemImage="arrow.clockwise" action={() => { void loadFiles() }} /></Menu></ToolbarItem></Toolbar>}><Section listRowBackground={<></>} listRowSeparator="hidden"><VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden"><VStack spacing={8} padding={14} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}><HStack spacing={8} alignment="center" frame={{ maxWidth: "infinity", alignment: "leading" }}><PullRequestDetailSymbol systemName={pullRequest.draft ? "doc.badge.ellipsis" : "arrow.triangle.pull"} foregroundStyle={pullRequest.draft ? "systemOrange" : "systemGreen"} /><VStack spacing={4} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={17} fontWeight="semibold" lineLimit={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>{pullRequest.title}</Text><Text font={12} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }}>{`#${pullRequest.number} · ${pullRequest.authorName} · ${pullRequest.draft ? "草稿" : "开放"}`}</Text><Text font={13} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }}>{`${pullRequest.headBranch} → ${pullRequest.baseBranch}`}</Text></VStack></HStack></VStack><VStack spacing={8} padding={14} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}><Text font={13} fontWeight="semibold">说明</Text><Text font={13} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }}>{pullRequest.body.trim() || "此 Pull Request 没有说明。"}</Text></VStack>{state === "loading" && files.length === 0 ? <StatusSurface icon="doc.text.magnifyingglass" title="正在读取变更文件" detail="正在同步此 Pull Request 的文件列表。" loading /> : null}{state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="无法读取变更文件" detail={error} action={() => { void loadFiles() }} /> : null}{state === "loaded" && files.length === 0 ? <StatusSurface icon="doc" title="没有变更文件" detail="GitHub 没有返回此 Pull Request 的文件摘要。" /> : null}{state === "loaded" && files.length > 0 ? <VStack spacing={8} padding={14} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}><HStack spacing={8} alignment="center" frame={{ maxWidth: "infinity", alignment: "leading" }}><PullRequestDetailSymbol systemName="doc.on.doc" foregroundStyle={ACCENT} /><VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={13} fontWeight="semibold" frame={{ maxWidth: "infinity", alignment: "leading" }}>变更文件</Text><Text font={12} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }}>{`${files.length} 个文件 · +${additions} / -${deletions}`}</Text></VStack></HStack>{files.map(file => <HStack key={file.filename} spacing={8} alignment="center" frame={{ maxWidth: "infinity", alignment: "leading" }}><PullRequestDetailSymbol systemName={pullRequestFileIcon(file.status)} foregroundStyle={pullRequestFileColor(file.status)} /><VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}><Text font={13} lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>{file.filename}</Text><Text font={12} foregroundStyle="secondaryLabel">{`${pullRequestFileStatus(file.status)} · +${file.additions} / -${file.deletions}`}</Text></VStack></HStack>)}</VStack> : null}</VStack></Section></List>
}

function PullRequestDetailSymbol({ systemName, foregroundStyle }: { systemName: string; foregroundStyle: import("scripting").Color }) {
  return <VStack alignment="center" frame={{ width: 42, height: 42, alignment: "center" }}><Image systemName={systemName} font={18} foregroundStyle={foregroundStyle} /></VStack>
}

function pullRequestFileStatus(status: GitHubPullRequestFile["status"]): string {
  return status === "added" ? "新增" : status === "deleted" ? "删除" : status === "renamed" ? "重命名" : status === "copied" ? "复制" : status === "changed" ? "变更" : "修改"
}

function pullRequestFileIcon(status: GitHubPullRequestFile["status"]): string {
  return status === "added" ? "plus.circle" : status === "deleted" ? "minus.circle" : status === "renamed" ? "arrow.triangle.2.circlepath" : "doc.text"
}

function pullRequestFileColor(status: GitHubPullRequestFile["status"]): import("scripting").Color {
  return status === "added" ? "systemGreen" : status === "deleted" ? "systemRed" : status === "renamed" ? "systemOrange" : "secondaryLabel"
}


function formatCommitDate(value: string | null): string {
  if (!value) return "未知时间"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "未知时间"
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
