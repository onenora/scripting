import { Button, HStack, Image, List, Navigation, Section, Text, Toolbar, ToolbarItem, VStack, useState } from "scripting"
import { ACCENT, GLASS, MODE_STYLE, relativeTime, SettingRow, StatusSurface } from "./glass-ui"
import { currentBrowseIdentity, hasGitHubToken, readBrowseHistory, readTokenInfo, readUserSnapshot, removeBrowseUser } from "./github-api"

/** 设置页主页卡右上角进入：浏览记录、输入新用户、授权浏览时回到本人。每个用户的资料与 Star 已持久化，切换后直接显示。 */
export function BrowseSwitcherPage({ onAddUser, onSwitch }: { onAddUser: () => Promise<boolean>; onSwitch: (login: string | null) => Promise<void> }) {
  const dismiss = Navigation.useDismiss()
  const [history, setHistory] = useState(readBrowseHistory)
  const tokenActive = hasGitHubToken()
  const owner = tokenActive ? readTokenInfo()?.login ?? null : null
  const current = currentBrowseIdentity()
  // 授权浏览时本人单独置顶，不在记录里重复出现。
  const entries = history.filter(entry => entry.login.toLowerCase() !== owner?.toLowerCase())

  function choose(login: string | null) {
    void onSwitch(login)
    dismiss()
  }

  async function addUser() {
    if (await onAddUser()) dismiss()
  }

  async function remove(login: string) {
    const confirmed = await Dialog.confirm({ title: "删除浏览记录", message: `将删除 @${login} 的浏览记录，以及本机保存的资料与 Star 缓存。`, confirmLabel: "删除", cancelLabel: "取消" })
    if (!confirmed) return
    removeBrowseUser(login)
    setHistory(readBrowseHistory())
  }

  return (
    <List
      listStyle="inset"
      scrollContentBackground="hidden"
      listRowBackground={<></>}
      listRowSeparator="hidden"
      background="systemGroupedBackground"
      navigationTitle="切换浏览用户"
      navigationBarTitleDisplayMode="inline"
      toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem></Toolbar>}
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          <SettingRow icon="plus" tint={ACCENT} title="输入用户名" subtitle={tokenActive ? "浏览任意用户，请求仍使用 Token 限额" : "浏览任意用户的主页与公开 Star"} action={() => { void addUser() }} />
          {owner ? <BrowseUserRow login={owner} tag="本人" current={current === owner.toLowerCase()} onSelect={() => choose(null)} /> : null}
          <Text font={13} fontWeight="semibold" foregroundStyle="secondaryLabel" padding={{ horizontal: 4, top: 6 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>浏览记录</Text>
          {entries.length === 0 ? <StatusSurface icon="clock.arrow.circlepath" title="暂无浏览记录" detail="切换过的用户会保存在这里，资料与 Star 缓存在本机，再次切换无需重新请求。" /> : null}
          {entries.map(entry => (
            <BrowseUserRow
              key={entry.login.toLowerCase()}
              login={entry.login}
              current={current === entry.login.toLowerCase()}
              onSelect={() => choose(entry.login)}
              onDelete={() => { void remove(entry.login) }}
            />
          ))}
          <Text font={11} foregroundStyle="tertiaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }} padding={{ horizontal: 4 }}>浏览记录与各用户的资料、Star 缓存只保存在本机，删除记录会一并清除。当前浏览的用户不能删除。</Text>
        </VStack>
      </Section>
    </List>
  )
}

function BrowseUserRow({ login, tag, current, onSelect, onDelete }: { login: string; tag?: string; current: boolean; onSelect: () => void; onDelete?: () => void }) {
  const snapshot = readUserSnapshot(login)
  const account = snapshot.account
  const starCount = snapshot.stars?.length ?? 0
  const detail = snapshot.syncedAt ? `${starCount}${typeof snapshot.nextPage === "number" ? "+" : ""} 个 Star · ${relativeTime(snapshot.syncedAt)}` : "尚未加载"
  return (
    <HStack spacing={10} padding={{ horizontal: 14, vertical: 10 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.interactive}>
      <Button action={onSelect} disabled={current} buttonStyle="borderless" accessibilityLabel={`浏览 @${login}`} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          {account?.avatarUrl
            ? <Image imageUrl={account.avatarUrl} resizable={true} aspectRatio={{ contentMode: "fill" }} frame={{ width: 40, height: 40 }} clipShape={account.type === "Organization" ? { type: "rect", cornerRadius: 9 } : "circle"} />
            : <Image systemName="person.crop.circle.fill" font={34} foregroundStyle="secondaryLabel" frame={{ width: 40, height: 40 }} />}
          <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <HStack spacing={6}>
              <Text font={15} fontWeight="semibold" foregroundStyle="label" lineLimit={1}>{account?.name ?? login}</Text>
              {tag ? <Text font={11} fontWeight="semibold" foregroundStyle={ACCENT} padding={{ horizontal: 7, vertical: 2 }} glassEffect={GLASS.capsule}>{tag}</Text> : null}
            </HStack>
            <Text font={12} foregroundStyle="secondaryLabel" lineLimit={1}>{`@${login} · ${detail}`}</Text>
          </VStack>
        </HStack>
      </Button>
      {current
        ? <Text font={11} fontWeight="semibold" foregroundStyle={MODE_STYLE.token.color} padding={{ horizontal: 8, vertical: 3 }} glassEffect={GLASS.capsule}>当前</Text>
        : onDelete
          ? <Button action={onDelete} buttonStyle="borderless" accessibilityLabel={`删除 @${login} 的浏览记录`} frame={{ minWidth: 36, minHeight: 36 }}><Image systemName="trash" font={15} foregroundStyle="systemRed" /></Button>
          : null}
    </HStack>
  )
}
