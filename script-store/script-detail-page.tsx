import { Button, Divider, HStack, Image, Label, List, Menu, Section, Spacer, Text, VStack, useState } from "scripting"
import { toggleFavorite, useFavorites } from "./favorites"
import { ACCENT, CARD_ROW, FootNote, GLASS, GetButton, HIDDEN_TITLE, PageHeader, ScriptIcon, SectionTitle, StatusSurface, Tag, errorMessage } from "./glass-ui"
import { installScript } from "./install"
import { authorNames, formatDate, hasAuthor, hostOf, type StoreScript } from "./store-api"
import { useUIFont } from "./ui-font"

async function install(item: StoreScript) {
  try {
    await installScript(item.url)
  } catch (error) {
    await Dialog.alert({ title: "无法安装", message: errorMessage(error) })
  }
}

function useInstall(item: StoreScript) {
  const [busy, setBusy] = useState(false)
  async function run() {
    if (busy) return
    setBusy(true)
    await install(item)
    setBusy(false)
  }
  return { busy, run: () => void run() }
}

/** 列表卡片：点按进入详情，「获取」直接导入，右滑收藏。 */
export function ScriptCard({ item, favorite, onOpen }: { item: StoreScript; favorite: boolean; onOpen: () => void }) {
  const { busy, run } = useInstall(item)
  const authors = authorNames(item.author).join("、") || "未知作者"
  const font = useUIFont()

  return (
    <HStack
      spacing={12}
      padding={{ horizontal: 14, vertical: 12 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      glassEffect={GLASS.content}
      contentShape={{ type: "rect", cornerRadius: 16 }}
      onTapGesture={onOpen}
      {...CARD_ROW}
      leadingSwipeActions={{
        actions: [<Button title={favorite ? "取消收藏" : "收藏"} systemImage={favorite ? "star.slash" : "star"} tint="systemYellow" action={() => { toggleFavorite(item.id) }} />],
      }}
    >
      <ScriptIcon item={item} size={52} />
      <VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <HStack spacing={4}>
          <Text font={font(16)} fontWeight="semibold" foregroundStyle="label" lineLimit={1}>{item.name}</Text>
          {favorite ? <Image systemName="star.fill" font={10} foregroundStyle="systemYellow" /> : null}
        </HStack>
        <Text font={font(12)} foregroundStyle="secondaryLabel" lineLimit={1}>{item.description.split("\n")[0] || "暂无描述"}</Text>
        <Text font={font(11)} foregroundStyle="tertiaryLabel" lineLimit={1}>{`${authors} · ${item.installCount} 次安装 · ${formatDate(item.updateTime)}`}</Text>
      </VStack>
      <GetButton action={run} busy={busy} />
    </HStack>
  )
}

/** App Store 式信息条中的一栏。 */
function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  const font = useUIFont()
  return (
    <VStack spacing={4} frame={{ maxWidth: "infinity" }}>
      <Text font={font(10)} fontWeight="semibold" foregroundStyle="secondaryLabel">{label}</Text>
      <Image systemName={icon} font={15} fontWeight="semibold" foregroundStyle="secondaryLabel" />
      <Text font={font(13)} fontWeight="semibold" foregroundStyle="label" lineLimit={1} minScaleFactor={0.7}>{value}</Text>
    </VStack>
  )
}

/** 信息卡中的一行：左侧标签，右侧值。 */
function InfoRow({ label, value }: { label: string; value: string }) {
  const font = useUIFont()
  return (
    <HStack spacing={12} frame={{ maxWidth: "infinity" }}>
      <Text font={font(15)} foregroundStyle="label">{label}</Text>
      <Spacer />
      <Text font={font(14)} foregroundStyle="secondaryLabel" lineLimit={1} truncationMode="middle">{value}</Text>
    </HStack>
  )
}

/** 脚本详情：大图标 + 获取按钮，信息条、描述与链接信息；收藏与分享在工具栏。 */
export function ScriptDetailPage({ item, scripts }: { item: StoreScript; scripts: StoreScript[] }) {
  const favorites = useFavorites()
  const favorite = favorites.includes(item.id)
  const { busy, run } = useInstall(item)
  const [author, setAuthor] = useState<string | null>(null)
  const authors = authorNames(item.author)
  const isWeb = /^https?:/i.test(item.url)
  const font = useUIFont()

  async function copyLink() {
    await Pasteboard.setString(item.url)
    HapticFeedback.notificationSuccess()
  }

  return (
    <List
      listStyle="inset"
      scrollContentBackground="hidden"
      background="systemGroupedBackground"
      navigationTitle={item.name}
      navigationBarTitleDisplayMode="inline"
      navigationDestination={{
        isPresented: author !== null,
        onChanged: presented => {
          if (!presented) setAuthor(null)
        },
        content: author ? <AuthorPage name={author} scripts={scripts} /> : <></>,
      }}
      toolbar={{
        // 名称已在头部显示，盖住导航栏中间的系统标题。
        principal: HIDDEN_TITLE,
        primaryAction: [
          <Button title={favorite ? "取消收藏" : "收藏"} systemImage={favorite ? "star.fill" : "star"} tint={favorite ? "systemYellow" : undefined} action={() => { toggleFavorite(item.id) }} />,
          <Menu label={<Label title="更多" systemImage="ellipsis" />}>
            <Button title="复制脚本链接" systemImage="doc.on.doc" action={() => void copyLink()} />
            <Button title="分享链接" systemImage="square.and.arrow.up" action={() => void ShareSheet.present([item.url])} />
            {isWeb ? <Button title="在 Safari 中打开" systemImage="safari" action={() => void Safari.present(item.url, true)} /> : <></>}
          </Menu>,
        ],
      }}
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <HStack spacing={16} alignment="top" padding={{ horizontal: 4, vertical: 6 }} frame={{ maxWidth: "infinity", alignment: "leading" }} {...CARD_ROW}>
          <ScriptIcon item={item} size={104} />
          <VStack spacing={6} alignment="leading" frame={{ maxWidth: "infinity", minHeight: 104, alignment: "topLeading" }}>
            <Text font={font(22)} fontWeight="bold" foregroundStyle="label" lineLimit={2}>{item.name}</Text>
            <HStack spacing={6}>
              {(authors.length ? authors : ["未知作者"]).map(name => (
                <Button key={name} action={() => setAuthor(name)} disabled={!authors.length} accessibilityLabel={`查看 ${name} 的作品`} buttonStyle="borderless">
                  <Text font={font(14)} foregroundStyle={ACCENT} lineLimit={1}>{name}</Text>
                </Button>
              ))}
            </HStack>
            <Spacer />
            <HStack spacing={8}>
              <GetButton action={run} busy={busy} prominent />
              {item.verified ? <Tag text="链接可访问" color="systemGreen" icon="checkmark.seal" /> : null}
            </HStack>
          </VStack>
        </HStack>

        <HStack spacing={0} padding={{ vertical: 12 }} frame={{ maxWidth: "infinity" }} glassEffect={GLASS.content} {...CARD_ROW}>
          <Stat label="安装" value={`${item.installCount}`} icon="arrow.down.circle" />
          <Divider frame={{ height: 36 }} />
          <Stat label="更新" value={formatDate(item.updateTime)} icon="calendar" />
          <Divider frame={{ height: 36 }} />
          <Stat label="来源" value={hostOf(item.url)} icon={isWeb ? "globe" : "link"} />
        </HStack>
      </Section>

      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <SectionTitle icon="text.alignleft" title="描述" />
        <Text font={font(15)} foregroundStyle={item.description ? "label" : "secondaryLabel"} padding={16} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
          {item.description || "作者没有填写描述。"}
        </Text>
      </Section>

      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <SectionTitle icon="info.circle" title="信息" />
        <VStack spacing={10} padding={16} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
          <InfoRow label="作者" value={authors.join("、") || "未知"} />
          <Divider />
          <InfoRow label="更新时间" value={item.updateTime || "未知"} />
          <Divider />
          <InfoRow label="脚本链接" value={item.url} />
          <Divider />
          <InfoRow label="ID" value={String(item.id)} />
        </VStack>
        <FootNote>「获取」会打开 Scripting 的导入确认，由 App 下载并添加脚本。脚本由第三方作者提供，安装前请确认来源可信。</FootNote>
      </Section>
    </List>
  )
}

/** 某位作者的全部作品，按更新时间排序。 */
function AuthorPage({ name, scripts }: { name: string; scripts: StoreScript[] }) {
  const favorites = useFavorites()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const works = scripts.filter(item => hasAuthor(item, name)).sort((left, right) => right.updateTime.localeCompare(left.updateTime))
  const selected = works.find(item => item.id === selectedId)
  const installs = works.reduce((sum, item) => sum + item.installCount, 0)

  return (
    <List
      listStyle="inset"
      scrollContentBackground="hidden"
      background="systemGroupedBackground"
      navigationTitle={name}
      navigationBarTitleDisplayMode="inline"
      toolbar={{ principal: HIDDEN_TITLE }}
      navigationDestination={{
        isPresented: selected !== undefined,
        onChanged: presented => {
          if (!presented) setSelectedId(null)
        },
        content: selected ? <ScriptDetailPage key={selected.id} item={selected} scripts={scripts} /> : <></>,
      }}
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <PageHeader title={name} chip={`${works.length} 个作品 · 共 ${installs} 次安装`} chipIcon="person.crop.circle" />
      </Section>
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        {works.length === 0 ? <StatusSurface icon="tray" title="暂无作品" detail="商店中没有这位作者的其他脚本。" /> : null}
        {works.map(item => <ScriptCard key={item.id} item={item} favorite={favorites.includes(item.id)} onOpen={() => setSelectedId(item.id)} />)}
      </Section>
    </List>
  )
}
