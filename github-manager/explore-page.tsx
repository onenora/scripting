import {
  Button,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Text,
  VStack,
  useEffect,
  useState,
} from "scripting"
import { readAccessMode, readCachedSearchRepositories, searchRepositories } from "./github-api"
import { useFavorites } from "./favorites"
import { errorStatusDetail, GLASS, HeaderIconButton, MODE_STYLE, ModeBadge, PageBackground, StatusSurface } from "./glass-ui"
import { RepositoryRow } from "./repository-browser"
import type { AccessMode, GitHubRepository, LoadState } from "./types"

export function ExplorePage({ mode = readAccessMode(), onSubscriptionsChange }: { mode?: AccessMode; onSubscriptionsChange?: () => void }) {
  const favorites = useFavorites()
  const [repositories, setRepositories] = useState<GitHubRepository[]>(() => readCachedSearchRepositories("") ?? [])
  const [query, setQuery] = useState("")
  const [state, setState] = useState<LoadState>(() => mode === "token" ? "loading" : readCachedSearchRepositories("") ? "loaded" : "idle")
  const [error, setError] = useState("")

  async function load(nextQuery = query, fresh = false) {
    setState("loading")
    setError("")
    try {
      setRepositories(await searchRepositories(nextQuery, fresh))
      setQuery(nextQuery)
      setState("loaded")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法加载热门开源仓库。")
      setState("error")
    }
  }

  // 公共浏览不自动请求：有缓存直接显示，否则等待手动加载。
  useEffect(() => { if (mode === "token") void load("") }, [])

  async function promptSearch() {
    const input = await Dialog.prompt({
      title: "搜索 GitHub 仓库",
      message: "请输入关键词、owner/repository 或 GitHub 查询语法；留空可查看热门开源仓库。",
      defaultValue: query,
      placeholder: "例如：apple/swift、language:swift、topic:cli",
      confirmLabel: "搜索",
    })
    if (input === null) return
    await load(input.trim())
  }

  const favoriteNames = new Set(favorites.map(favorite => favorite.fullName.toLowerCase()))

  return (
    <List
      listStyle="inset"
      refreshable={() => load(query, true)}
      scrollContentBackground="hidden"
      scrollEdgeEffectHidden={{ edges: "top", hidden: true }}
      listRowBackground={<></>}
      listRowSeparator="hidden"
      navigationTitle="探索"
      navigationBarTitleDisplayMode="inline"
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          <ExploreHeader query={query} count={repositories.length} state={state} mode={mode} onSearch={() => { void promptSearch() }} onRefresh={() => { void load(query, true) }} />
          {state === "idle" ? <StatusSurface icon="sparkles" iconForegroundStyle={MODE_STYLE.public.color} title="热门开源仓库" detail="公共浏览不会自动请求 GitHub。点击加载或使用搜索，结果会缓存 30 分钟。" action={() => { void load("") }} actionTitle="加载热门仓库" actionSystemImage="arrow.down.circle" /> : null}
          {state === "loading" && repositories.length === 0 ? <StatusSurface icon="sparkles" title="正在加载热门开源仓库" detail="正在从 GitHub 获取热门开源仓库。" isLoading /> : null}
          {state === "error" ? <StatusSurface icon="exclamationmark.triangle.fill" title="加载仓库失败" detail={errorStatusDetail(error, mode === "token" ? "请检查网络连接、Token 是否有效或查询语法后重试。" : "请检查网络连接或查询语法后重试；公共浏览搜索每分钟限 10 次。")} action={() => { void load(query) }} /> : null}
          {state === "loaded" && repositories.length === 0 ? <StatusSurface icon="magnifyingglass" title="未找到匹配的仓库" detail="请更换搜索关键词，或使用 owner/repository、language:swift 等查询条件。" action={() => { void promptSearch() }} /> : null}
          {repositories.map(repository => <RepositoryRow key={String(repository.id)} repository={repository} favorite={favoriteNames.has(repository.fullName.toLowerCase())} onSubscriptionsChange={onSubscriptionsChange} />)}
        </VStack>
      </Section>
    </List>
  )
}

/** 顶部：标题与模式，下方为搜索入口（轻点弹出查询输入）与刷新。 */
function ExploreHeader({ query, count, state, mode, onSearch, onRefresh }: { query: string; count: number; state: LoadState; mode: AccessMode; onSearch: () => void; onRefresh: () => void }) {
  const title = (
    <HStack spacing={8}>
      <Image systemName="sparkles" font={15} foregroundStyle="systemBlue" />
      <Text font={18} fontWeight="semibold">{query ? "搜索结果" : "热门开源仓库"}</Text>
      <ModeBadge mode={mode} />
    </HStack>
  )
  const searchField = (
    <Button action={onSearch} buttonStyle="borderless" frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }} padding={{ horizontal: 12 }} glassEffect={GLASS.interactiveCapsule} accessibilityLabel="搜索 GitHub 仓库">
      <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Image systemName="magnifyingglass" font={14} foregroundStyle="secondaryLabel" />
        <Text font={14} foregroundStyle={query ? "label" : "tertiaryLabel"} lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{query || "搜索仓库或 owner/repo"}</Text>
      </HStack>
    </Button>
  )
  return (
    <VStack spacing={10} alignment="leading" padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
      <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {title}
        <Spacer />
        <HeaderIconButton icon="arrow.clockwise" label="刷新探索结果" action={onRefresh} />
      </HStack>
      {/* 搜索框宽度取自标题行（隐藏副本），尾部与模式胶囊对齐。 */}
      <HStack frame={{ minHeight: 40 }} overlay={searchField}>
        <HStack opacity={0}>{title}</HStack>
      </HStack>
      <Text font={12} foregroundStyle="secondaryLabel">{state === "loaded" ? `${count} 个仓库 · 轻点可浏览、收藏或查看作者` : state === "idle" ? "尚未加载" : "加载中"}</Text>
    </VStack>
  )
}

export default function ExploreRoot() {
  return <PageBackground><ExplorePage /></PageBackground>
}
