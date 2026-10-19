import { Button, Divider, HStack, Image, Label, List, Menu, Navigation, NavigationStack, Picker, ScrollView, Section, Spacer, Text, VStack, useEffect, useMemo, useState } from "scripting"
import { useFavorites } from "./favorites"
import { ACCENT, CapsuleButton, FootNote, GLASS, ScriptIcon, SectionTitle, StatusSurface, errorMessage } from "./glass-ui"
import { presentPublish } from "./publish-page"
import { ScriptCard, ScriptDetailPage } from "./script-detail-page"
import { fetchNotice, fetchScripts, type SiteNotice, type StoreScript } from "./store-api"
import { formatSavedAt, readSnapshot, saveSnapshot } from "./store-cache"
import { currentFontName, pickFont, setFontName, useUIFont } from "./ui-font"

type SortKey = "latest" | "popular" | "name"

const SORTS: { key: SortKey; title: string; icon: string }[] = [
  { key: "latest", title: "最近更新", icon: "clock" },
  { key: "popular", title: "安装最多", icon: "flame" },
  { key: "name", title: "名称", icon: "character" },
]

const COMPARE: Record<SortKey, (left: StoreScript, right: StoreScript) => number> = {
  latest: (left, right) => right.updateTime.localeCompare(left.updateTime),
  popular: (left, right) => right.installCount - left.installCount,
  name: (left, right) => left.name.localeCompare(right.name, "zh-Hans-CN"),
}

const TITLE = "Script Store"
const DEFAULT_NOTICE = "本商店非 Scripting 官方平台，脚本收集自互联网，版权归原作者所有。"
const POPULAR_COUNT = 10

/** 横向「热门」卡片，点按进入详情。 */
function PopularTile({ item, onOpen }: { item: StoreScript; onOpen: () => void }) {
  const font = useUIFont()
  return (
    <VStack spacing={8} padding={12} frame={{ width: 108 }} glassEffect={GLASS.interactive} contentShape={{ type: "rect", cornerRadius: 16 }} onTapGesture={onOpen}>
      <ScriptIcon item={item} size={60} />
      <VStack spacing={2}>
        <Text font={font(13)} fontWeight="semibold" foregroundStyle="label" lineLimit={1}>{item.name}</Text>
        <Text font={font(11)} foregroundStyle="secondaryLabel" lineLimit={1}>{`${item.installCount} 次安装`}</Text>
      </VStack>
    </VStack>
  )
}

/** 主页首张卡片：站点声明 + 插件数量与更新时间，与下方卡片同宽，顶部留出与导航栏的间距。 */
function NoticeCard({ text, count, updated }: { text: string; count: string; updated?: string }) {
  const font = useUIFont()
  return (
    <VStack spacing={12} padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} listRowBackground={<></>} listRowSeparator="hidden" listRowInsets={{ top: 16, leading: 20, bottom: 4, trailing: 20 }}>
      <HStack spacing={10} alignment="top" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Image systemName="info.circle" font={15} fontWeight="semibold" foregroundStyle={ACCENT} frame={{ width: 20 }} padding={{ top: 1 }} />
        <Text font={font(13)} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{text}</Text>
      </HStack>
      <Divider />
      <HStack spacing={10}>
        <Image systemName="shippingbox" font={15} fontWeight="semibold" foregroundStyle={ACCENT} frame={{ width: 20 }} />
        <VStack spacing={2} alignment="leading">
          <Text font={font(15)} foregroundStyle="label">插件</Text>
          {updated ? <Text font={font(11)} foregroundStyle="tertiaryLabel">{updated}</Text> : null}
        </VStack>
        <Spacer />
        <Text font={font(15)} fontWeight="semibold" foregroundStyle="secondaryLabel">{count}</Text>
      </HStack>
    </VStack>
  )
}

/** 商店主页：信息卡、热门、收藏与全部脚本；卡片点按进入详情。有快照时直接显示，下拉刷新。 */
export function StorePage() {
  const dismiss = Navigation.useDismiss()
  const favorites = useFavorites()
  const font = useUIFont()
  const fontName = currentFontName()
  const [snapshot] = useState(readSnapshot)
  const [scripts, setScripts] = useState<StoreScript[]>(snapshot?.scripts ?? [])
  const [notice, setNotice] = useState<SiteNotice | null>(snapshot?.notice ?? null)
  const [savedAt, setSavedAt] = useState(snapshot?.savedAt ?? 0)
  const [state, setState] = useState<"loading" | "loaded" | "error">(snapshot ? "loaded" : "loading")
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("latest")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = scripts.find(item => item.id === selectedId)

  async function load() {
    // 已有列表时刷新不清空界面，失败也保留当前数据。
    const hasData = scripts.length > 0
    if (!hasData) setState("loading")
    try {
      const [items, site] = await Promise.all([fetchScripts(), fetchNotice()])
      // 公告接口失败时返回空值，沿用上一份公告。
      const nextNotice = site.subtitle || site.warning ? site : notice ?? site
      setScripts(items)
      setNotice(nextNotice)
      setSavedAt(saveSnapshot(items, nextNotice).savedAt)
      setState("loaded")
    } catch (err) {
      if (hasData) {
        await Dialog.alert({ title: "刷新失败", message: `${errorMessage(err)}\n当前显示的是上次保存的列表。` })
        return
      }
      setError(errorMessage(err))
      setState("error")
    }
  }

  // 没有快照时才自动加载；有快照直接显示，下拉刷新。
  useEffect(() => { if (!snapshot) void load() }, [])

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const matched = keyword
      ? scripts.filter(item => `${item.name}\n${item.description}\n${item.author}`.toLowerCase().includes(keyword))
      : scripts
    return [...matched].sort(COMPARE[sort])
  }, [scripts, query, sort])

  const popular = useMemo(() => [...scripts].sort(COMPARE.popular).slice(0, POPULAR_COUNT), [scripts])

  const favoriteItems = useMemo(
    () => favorites.map(id => scripts.find(item => item.id === id)).filter((item): item is StoreScript => item !== undefined),
    [favorites, scripts],
  )

  async function chooseFont() {
    try {
      if (await pickFont()) HapticFeedback.notificationSuccess()
    } catch (err) {
      await Dialog.alert({ title: "无法选择字体", message: errorMessage(err) })
    }
  }

  async function publish() {
    if (await presentPublish()) await load()
  }

  const browsing = !query.trim()
  const current = SORTS.find(item => item.key === sort)!
  const open = (item: StoreScript) => setSelectedId(item.id)
  const card = (item: StoreScript) => <ScriptCard key={item.id} item={item} favorite={favorites.includes(item.id)} onOpen={() => open(item)} />

  return (
    <NavigationStack>
      <List
        listStyle="inset"
        scrollContentBackground="hidden"
        background="systemGroupedBackground"
        // 标题由 principal 自绘以使用界面字体；navigationTitle 只供返回按钮与多任务界面使用。
        navigationTitle={TITLE}
        navigationBarTitleDisplayMode="inline"
        refreshable={load}
        searchable={{ value: query, onChanged: setQuery, placement: "toolbar", prompt: "搜索名称、描述或作者" }}
        // 推入详情挂在 List 上：放在 List 行内的 navigationDestination 不会触发。
        navigationDestination={{
          isPresented: selected !== undefined,
          onChanged: presented => {
            if (!presented) setSelectedId(null)
          },
          content: selected ? <ScriptDetailPage key={selected.id} item={selected} scripts={scripts} /> : <></>,
        }}
        toolbar={{
          cancellationAction: <Button title="关闭" systemImage="xmark" action={() => dismiss()} />,
          principal: <Text font={font(17)} fontWeight="semibold" foregroundStyle="label">{TITLE}</Text>,
          primaryAction: [
            <Menu label={<Label title="显示选项" systemImage="line.3.horizontal.decrease" />}>
              <Picker title="排序" value={sort} onChanged={(value: string) => setSort(value as SortKey)} pickerStyle="inline">
                {SORTS.map(item => <Label key={item.key} title={item.title} systemImage={item.icon} tag={item.key} />)}
              </Picker>
              {/* SF Symbol textformat 在中文环境会本地化成汉字，字体图标用 f.cursive。 */}
              <Menu title={fontName ? `界面字体：${fontName}` : "界面字体：系统"} systemImage="f.cursive">
                <Button title="选择已安装字体…" systemImage="f.cursive" action={() => void chooseFont()} />
                {fontName ? <Button title="恢复系统字体" systemImage="arrow.uturn.backward" action={() => setFontName(null)} /> : <></>}
              </Menu>
            </Menu>,
            <Button title="发布" systemImage="plus" action={() => void publish()} />,
          ],
        }}
      >
        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <NoticeCard
            text={notice?.subtitle || DEFAULT_NOTICE}
            count={state === "loaded" ? `${visible.length} / ${scripts.length}` : "加载中"}
            updated={savedAt ? `更新于 ${formatSavedAt(savedAt)} · 下拉刷新` : undefined}
          />
        </Section>

        {browsing && popular.length ? (
          <Section listRowBackground={<></>} listRowSeparator="hidden">
            <SectionTitle icon="flame" title="热门" />
            <ScrollView axes="horizontal" scrollIndicator="hidden" listRowInsets={{ top: 4, leading: 0, bottom: 4, trailing: 0 }} listRowBackground={<></>} listRowSeparator="hidden">
              <HStack spacing={10} padding={{ horizontal: 20, vertical: 2 }}>
                {popular.map(item => <PopularTile key={item.id} item={item} onOpen={() => open(item)} />)}
              </HStack>
            </ScrollView>
          </Section>
        ) : null}

        {browsing && favoriteItems.length ? (
          <Section listRowBackground={<></>} listRowSeparator="hidden">
            <SectionTitle icon="star" title="收藏" detail={`${favoriteItems.length} 个`} />
            {favoriteItems.map(card)}
          </Section>
        ) : null}

        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle icon={browsing ? "square.grid.2x2" : "magnifyingglass"} title={browsing ? "全部脚本" : "搜索结果"} detail={state === "loaded" ? current.title : undefined} />
          {state === "loading" && scripts.length === 0 ? <StatusSurface icon="shippingbox" title="正在加载" detail="正在读取商店脚本列表。" loading /> : null}
          {state === "error" && scripts.length === 0 ? (
            <StatusSurface icon="exclamationmark.triangle.fill" title="无法加载商店" detail={error} iconForegroundStyle="systemRed">
              <CapsuleButton title="重试" icon="arrow.clockwise" prominent action={() => void load()} />
            </StatusSurface>
          ) : null}
          {state === "loaded" && visible.length === 0
            ? <StatusSurface icon="magnifyingglass" title={browsing ? "商店暂无脚本" : "没有匹配的脚本"} detail={browsing ? "下拉可重新加载。" : "换个关键词试试。"} />
            : null}
          {visible.map(card)}
          {notice?.warning ? <FootNote>{notice.warning}</FootNote> : null}
        </Section>
      </List>
    </NavigationStack>
  )
}
