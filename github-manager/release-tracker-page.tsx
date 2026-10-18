import {
  Button,
  HStack,
  Image,
  List,
  Navigation,
  NavigationStack,
  ProgressView,
  Section,
  Text,
  VStack,
  useState,
} from "scripting"
import { DESIGN, errorStatusDetail, GLASS, IconButton, openGitHubWebPage, PageBackground, relativeTime, StatusSurface } from "./glass-ui"
import {
  addReleaseSubscription,
  checkAllSubscriptions,
  checkSingleRelease,
  getUnreadReleaseCount,
  markAllReleasesAsRead,
  markReleaseAsRead,
  readReleaseInfoMap,
  readReleaseSubscriptions,
  removeReleaseSubscription,
} from "./release-tracker"
import { RepositoryReleasesPage } from "./repository-pages"

export function ReleaseTrackerPage({ onSubscriptionsChange }: { onSubscriptionsChange?: () => void }) {
  const [subscriptions, setSubscriptions] = useState(readReleaseSubscriptions)
  const [releaseMap, setReleaseMap] = useState(readReleaseInfoMap)
  const [checking, setChecking] = useState<string | null>(null)
  const [checkError, setCheckError] = useState("")

  const unreadCount = getUnreadReleaseCount()

  async function handleCheckAll() {
    if (subscriptions.length === 0) return
    setChecking(`0/${subscriptions.length}`)
    setCheckError("")
    try {
      const res = await checkAllSubscriptions((current, total, fullName) => {
        setChecking(`${current}/${total} · ${fullName}`)
      })
      setReleaseMap(readReleaseInfoMap())
      setChecking(null)
      if (res.errors.length > 0) {
        setCheckError(`${res.errors.length} 个仓库检查失败（可能不存在 Release 或请求受限）`)
      }
      onSubscriptionsChange?.()
    } catch (caught) {
      setChecking(null)
      setCheckError(caught instanceof Error ? caught.message : "检查新版本失败。")
    }
  }

  async function handleAddSubscription() {
    const input = await Dialog.prompt({
      title: "添加订阅仓库",
      message: "填入完整的 GitHub 仓库名（owner/repo），将会在检查时追踪其最新 Release。",
      placeholder: "例如 facebook/react 或 vuejs/core",
      confirmLabel: "添加",
    })
    if (!input?.trim()) return
    const fullName = input.trim()
    if (!fullName.includes("/")) {
      await Dialog.alert({ title: "格式错误", message: "请输入有效的 owner/repo 格式，例如 facebook/react" })
      return
    }
    addReleaseSubscription(fullName)
    setSubscriptions(readReleaseSubscriptions())
    onSubscriptionsChange?.()
    // 异步拉取一次该仓库的 release
    void checkSingleRelease(fullName).then(() => {
      setReleaseMap(readReleaseInfoMap())
      onSubscriptionsChange?.()
    })
  }

  function handleUnsubscribe(fullName: string) {
    removeReleaseSubscription(fullName)
    setSubscriptions(readReleaseSubscriptions())
    onSubscriptionsChange?.()
  }

  function handleMarkRead(fullName: string) {
    markReleaseAsRead(fullName)
    setReleaseMap(readReleaseInfoMap())
    onSubscriptionsChange?.()
  }

  function handleMarkAllRead() {
    markAllReleasesAsRead()
    setReleaseMap(readReleaseInfoMap())
    onSubscriptionsChange?.()
  }

  async function openRepoReleases(fullName: string) {
    const [owner, name] = fullName.split("/")
    if (!owner || !name) return
    await Navigation.present(
      <NavigationStack>
        <RepositoryReleasesPage repository={{ fullName, owner: { login: owner }, name }} />
      </NavigationStack>
    )
  }

  return (
    <PageBackground>
      <List
        listStyle="inset"
        scrollContentBackground="hidden"
        scrollEdgeEffectHidden={{ edges: "top", hidden: true }}
        listRowBackground={<></>}
        listRowSeparator="hidden"
        navigationTitle="Release 追踪"
        navigationBarTitleDisplayMode="inline"
      >
        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
            <ReleaseHeader
              total={subscriptions.length}
              unreadCount={unreadCount}
              checking={checking}
              onCheck={() => { void handleCheckAll() }}
              onAdd={() => { void handleAddSubscription() }}
              onMarkAllRead={handleMarkAllRead}
            />

            {checkError ? (
              <StatusSurface
                icon="exclamationmark.triangle.fill"
                title="检查提示"
                detail={errorStatusDetail(checkError)}
                action={() => { void handleCheckAll() }}
                actionTitle="重新检查"
              />
            ) : null}

            {/* 空状态 */}
            {subscriptions.length === 0 ? (
              <StatusSurface
                icon="bell.slash"
                title="暂无订阅仓库"
                detail="轻点任意仓库选择「订阅 Release 更新」，或手动输入 owner/repo。"
                action={() => { void handleAddSubscription() }}
                actionTitle="添加订阅"
                actionSystemImage="plus"
              />
            ) : null}

            {/* 订阅仓库列表 */}
            {subscriptions.map(fullName => {
              const info = releaseMap[fullName] ?? Object.entries(releaseMap).find(([k]) => k.toLowerCase() === fullName.toLowerCase())?.[1]
              const hasNew = Boolean(info && !info.seen)
              return (
                <VStack
                  key={fullName}
                  spacing={10}
                  alignment="leading"
                  padding={DESIGN.inset}
                  frame={{ maxWidth: "infinity", alignment: "leading" }}
                  glassEffect={GLASS.content}
                >
                  <HStack spacing={10} alignment="top" frame={{ maxWidth: "infinity", alignment: "leading" }}>
                    <Image
                      systemName={hasNew ? "bell.badge.fill" : "shippingbox.fill"}
                      foregroundStyle={hasNew ? "systemRed" : "systemBlue"}
                      font={20}
                      frame={{ width: 28, height: 28, alignment: "center" }}
                    />
                    <VStack spacing={4} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
                      <HStack spacing={6} frame={{ maxWidth: "infinity", alignment: "leading" }}>
                        <Text font={16} fontWeight="semibold" lineLimit={1}>{fullName}</Text>
                        {hasNew ? (
                          <Text font={11} fontWeight="semibold" foregroundStyle="systemRed" padding={{ horizontal: 7, vertical: 2 }} glassEffect={GLASS.capsule}>新版本</Text>
                        ) : null}
                      </HStack>
                      {info ? (
                        <Text font={13} foregroundStyle="secondaryLabel" lineLimit={2}>
                          {`${info.tag} · ${info.name || "（无标题）"}${info.publishedAt ? ` · ${relativeTime(info.publishedAt)}` : ""}`}
                        </Text>
                      ) : (
                        <Text font={13} foregroundStyle="tertiaryLabel">尚未获取 Release，点击「检查新版本」</Text>
                      )}
                    </VStack>
                  </HStack>

                  {/* 操作按钮组 */}
                  <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
                    <Button
                      title="查看 Releases"
                      systemImage="shippingbox"
                      action={() => { void openRepoReleases(fullName) }}
                      buttonStyle="plain"
                      padding={{ horizontal: 10, vertical: 6 }}
                      glassEffect={GLASS.interactiveCapsule}
                    />
                    {info?.htmlUrl ? (
                      <Button
                        title="在网页打开"
                        systemImage="arrow.up.right"
                        action={() => { void openGitHubWebPage(info.htmlUrl, fullName) }}
                        buttonStyle="plain"
                        padding={{ horizontal: 10, vertical: 6 }}
                        glassEffect={GLASS.interactiveCapsule}
                      />
                    ) : null}
                    {hasNew ? (
                      <Button
                        title="标为已读"
                        systemImage="checkmark"
                        action={() => handleMarkRead(fullName)}
                        buttonStyle="plain"
                        padding={{ horizontal: 10, vertical: 6 }}
                        glassEffect={GLASS.interactiveCapsule}
                      />
                    ) : null}
                    <Button
                      title="取消订阅"
                      systemImage="bell.slash"
                      role="destructive"
                      action={() => handleUnsubscribe(fullName)}
                      buttonStyle="plain"
                      padding={{ horizontal: 10, vertical: 6 }}
                      glassEffect={GLASS.interactiveCapsule}
                    />
                  </HStack>
                </VStack>
              )
            })}
          </VStack>
        </Section>
      </List>
    </PageBackground>
  )
}

/** 顶部卡片：标题与未读数，主按钮检查新版本（检查中显示进度），右侧添加订阅与全部已读。 */
function ReleaseHeader({ total, unreadCount, checking, onCheck, onAdd, onMarkAllRead }: { total: number; unreadCount: number; checking: string | null; onCheck: () => void; onAdd: () => void; onMarkAllRead: () => void }) {
  const summary = checking
    ? `正在检查 ${checking}`
    : total === 0 ? "还没有订阅仓库" : `已订阅 ${total} 个仓库 · ${unreadCount > 0 ? `${unreadCount} 个有新版本` : "全部已是最新"}`
  return (
    <VStack spacing={10} alignment="leading" padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
      <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Image systemName={unreadCount > 0 ? "bell.badge.fill" : "bell.fill"} font={15} foregroundStyle="systemRed" />
        <Text font={18} fontWeight="semibold">Release 追踪</Text>
        {unreadCount > 0 ? <Text font={12} fontWeight="semibold" foregroundStyle="systemRed" padding={{ horizontal: 9, vertical: 4 }} glassEffect={GLASS.capsule}>{`${unreadCount} 个新版本`}</Text> : null}
      </HStack>
      <Text font={12} foregroundStyle="secondaryLabel" lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{summary}</Text>
      <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Button
          action={onCheck}
          disabled={Boolean(checking) || total === 0}
          buttonStyle="borderless"
          frame={{ maxWidth: "infinity", minHeight: 40 }}
          glassEffect={GLASS.interactiveCapsule}
          accessibilityLabel="检查新版本"
        >
          <HStack spacing={6} alignment="center">
            {checking ? <ProgressView progressViewStyle="circular" controlSize="small" /> : <Image systemName="arrow.clockwise" font={14} fontWeight="semibold" />}
            <Text font={15} fontWeight="medium">{checking ? "检查中…" : "检查新版本"}</Text>
          </HStack>
        </Button>
        {unreadCount > 0 ? <IconButton icon="checkmark.circle" label="全部标为已读" action={onMarkAllRead} /> : null}
        <IconButton icon="plus" label="添加订阅" action={onAdd} />
      </HStack>
    </VStack>
  )
}

export default ReleaseTrackerPage

