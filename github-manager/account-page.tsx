import {
  Button,
  HStack,
  Image,
  List,
  Navigation,
  NavigationStack,
  Section,
  Text,
  Toolbar,
  ToolbarItem,
  VStack,
  useState,
  type VirtualNode,
} from "scripting"
import { AboutCard, AboutLine, CapabilityLine, GLASS, MODE_STYLE, ModeBadge, relativeTime, SectionTitle, SettingRow } from "./glass-ui"
import { hasGitHubToken, isBrowsingTokenOwner, readTokenInfo } from "./github-api"
import { BrowseSwitcherPage } from "./browse-switcher-page"
import { openReleaseDownloads } from "./repository-pages"
import { OwnerProfileCard, type OwnerRelation } from "./repository-browser"
import type { AccessMode, GitHubOwnerProfile, LoadState, TokenInfo } from "./types"

export type AccountActions = {
  /** 弹出输入框切换用户，返回是否已切换。 */
  onConfigureUsername: () => Promise<boolean>
  /** null 表示回到 Token 所属账户。 */
  onSwitchBrowseUser: (login: string | null) => Promise<void>
  onRemoveUsername: () => void
  // Token 相关操作返回 Promise，二级页等待完成后刷新或关闭。
  onConfigureToken: () => Promise<void>
  onSignOutToken: () => Promise<void>
  onResumeToken: () => Promise<void>
  onDeleteToken: () => Promise<void>
  onVerifyToken: () => Promise<void>
  onUpgradeTokenProtection: () => Promise<void>
  /** 资料卡「仓库」：授权浏览打开我的仓库（含私有），公共浏览打开公开仓库。 */
  onOpenOwnerRepositories: (login: string) => void
  onConvertRawLink: () => void
}

/** 设置页按读取方式渲染：引导选择 / 公共浏览 / Token 授权浏览。应用全程只读。 */
export function AccountPage({
  mode,
  account,
  accountState,
  username,
  tokenInfo,
  actions,
}: {
  mode: AccessMode
  account: GitHubOwnerProfile | null
  accountState: LoadState
  username: string | null
  tokenInfo: TokenInfo | null
  actions: AccountActions
}) {
  return (
    <List listStyle="inset" scrollContentBackground="hidden" listRowBackground={<></>} listRowSeparator="hidden" navigationTitle="设置" navigationBarTitleDisplayMode="inline">
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          {mode === "none" && tokenInfo ? <PausedTokenCard info={tokenInfo} actions={actions} /> : null}
          {mode === "none" ? <ModeChooser onChoosePublic={() => { void actions.onConfigureUsername() }} onChooseToken={actions.onConfigureToken} /> : null}
          {mode !== "none" ? <BrowseManagement mode={mode} account={account} accountState={accountState} username={username} tokenInfo={tokenInfo} actions={actions} /> : null}
          <SectionTitle icon="wrench.and.screwdriver" title="工具" />
          <SettingRow icon="link" title="GitHub Raw 链接转换" action={actions.onConvertRawLink} />
          <SettingRow icon="folder" title="Release 下载文件夹" action={() => { void openReleaseDownloads() }} />
          {mode === "token" ? <TokenSecurityRow info={tokenInfo} failed={accountState === "error"} actions={actions} /> : null}
          <SectionTitle icon="info.circle" title="关于" />
          <AboutCard>
            <AboutLine icon="eye" title="只读访问" detail="浏览 Stars、仓库文件、Release 与作者主页，不会修改 GitHub 上的任何内容。" />
            <AboutLine icon="internaldrive" title="本地数据" detail="收藏、置顶、Release 订阅与下载文件只保存在本机，与账户无关。" />
            <AboutLine icon="key.fill" title="Token 安全" detail="加密保存在钥匙串，仅此设备可读，不同步 iCloud，界面不显示完整 Token。" />
          </AboutCard>
        </VStack>
      </Section>
    </List>
  )
}

/** 未配置时的二选一引导：两种方式都只读，区别在请求限额与可见范围。 */
export function ModeChooser({ onChoosePublic, onChooseToken }: { onChoosePublic: () => void; onChooseToken: () => void }) {
  return (
    <VStack spacing={12} frame={{ maxWidth: "infinity" }}>
      <VStack spacing={6} alignment="leading" padding={{ horizontal: 18, vertical: 16 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
        <Text font={13} fontWeight="semibold" foregroundStyle="systemOrange">选择读取方式</Text>
        <Text font={20} fontWeight="semibold">如何读取 GitHub？</Text>
        <Text font={13} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>本应用只读，不会修改 GitHub 上的任何内容。探索、作者主页与本地收藏无需配置即可使用；Stars 列表需要指定用户名或 Token。</Text>
      </VStack>
      <ModeCard
        mode="public"
        headline="公共浏览 · 免 Token"
        summary="输入任意 GitHub 用户名，浏览其公开 Star。"
        available={["公开 Star 列表、仓库文件与 Release", "探索、作者主页、本地收藏"]}
        locked={["每小时 60 次请求（按网络 IP 计算），优先读本地缓存"]}
        actionTitle="输入用户名"
        actionIcon="person.fill"
        action={onChoosePublic}
      />
      <ModeCard
        mode="token"
        headline="授权浏览 · Personal Access Token"
        summary="Token 只用于提升限额与读取你的私有仓库，仍可浏览任意用户。"
        available={["包含公共浏览的全部功能", "我的 Star 与我的仓库（含私有，视 Token 范围）", "每小时 5000 次请求"]}
        locked={[]}
        actionTitle="添加 Token"
        actionIcon="key.horizontal"
        action={onChooseToken}
      />
    </VStack>
  )
}

function ModeCard({ mode, headline, summary, available, locked, actionTitle, actionIcon, action }: { mode: AccessMode; headline: string; summary: string; available: string[]; locked: string[]; actionTitle: string; actionIcon: string; action: () => void }) {
  const style = MODE_STYLE[mode]
  return (
    <VStack spacing={12} alignment="leading" padding={{ horizontal: 18, vertical: 16 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
      <HStack spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Image systemName={style.icon} font={24} foregroundStyle={style.color} frame={{ width: 30 }} />
        <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={16} fontWeight="semibold">{headline}</Text>
          <Text font={13} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{summary}</Text>
        </VStack>
      </HStack>
      <VStack spacing={6} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {available.map(text => <CapabilityLine key={text} enabled={true} text={text} />)}
        {locked.map(text => <CapabilityLine key={text} enabled={false} text={text} />)}
      </VStack>
      <Button title={actionTitle} systemImage={actionIcon} action={action} tint={style.color} buttonStyle="borderless" frame={{ maxWidth: "infinity" }} padding={{ vertical: 10 }} glassEffect={GLASS.interactiveCapsule} />
    </VStack>
  )
}

/** 两种方式同一套界面：主页卡右上角进入切换页浏览任意用户；授权浏览只是请求带 Token，限额更高。 */
function BrowseManagement({ mode, account, accountState, username, tokenInfo, actions }: { mode: AccessMode; account: GitHubOwnerProfile | null; accountState: LoadState; username: string | null; tokenInfo: TokenInfo | null; actions: AccountActions }) {
  const tokenActive = mode === "token"
  const browsingSelf = tokenActive && isBrowsingTokenOwner()
  const ownerLogin = tokenInfo?.login
  const status = accountState === "error"
    ? browsingSelf ? "Token 验证失败，请在「GitHub Token 管理」中重新验证或更换。" : "用户信息暂时无法读取，请检查用户名或网络。"
    : accountState === "loading"
      ? "正在读取用户信息…"
      : account ? null : "Stars 页加载后显示用户信息"
  const login = account?.login ?? username ?? ownerLogin ?? ""
  const switchButton = (
    <Button
      action={() => { void Navigation.present(<NavigationStack><BrowseSwitcherPage onAddUser={actions.onConfigureUsername} onSwitch={actions.onSwitchBrowseUser} /></NavigationStack>) }}
      buttonStyle="borderless"
      accessibilityLabel="切换浏览用户"
      frame={{ width: 36, height: 36 }}
      glassEffect={GLASS.interactiveCapsule}
    >
      <Image systemName="arrow.left.arrow.right" font={14} fontWeight="semibold" foregroundStyle={MODE_STYLE[mode].color} />
    </Button>
  )
  return (
    <VStack spacing={12} frame={{ maxWidth: "infinity" }}>
      <IdentityHeader mode={mode} account={account} login={login ? `@${login}` : "未验证账户"} status={status} warning={accountState === "error"} relation={tokenActive ? (browsingSelf ? "self" : "other") : undefined} headerAction={switchButton} onOpenRepositories={actions.onOpenOwnerRepositories} />
      {tokenActive ? null : <SettingRow icon="person.crop.circle.badge.minus" title="停止浏览" subtitle="清除当前用户名，浏览记录与收藏保留" destructive action={actions.onRemoveUsername} />}
      {tokenActive ? null : tokenInfo ? <PausedTokenCard info={tokenInfo} actions={actions} /> : <VStack spacing={10} alignment="leading" padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
        <HStack spacing={8}><Image systemName={MODE_STYLE.token.icon} foregroundStyle={MODE_STYLE.token.color} /><Text font={15} fontWeight="semibold">添加 Token 提升限额</Text></HStack>
        <Text font={13} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>公共浏览每小时 60 次请求。添加只读 Token 后限额提升至 5000 次/小时，继续浏览当前用户，也可一键回到自己的主页。</Text>
        <Button title="添加 Token" systemImage="key.horizontal" tint={MODE_STYLE.token.color} action={actions.onConfigureToken} buttonStyle="borderless" frame={{ maxWidth: "infinity" }} padding={{ vertical: 10 }} glassEffect={GLASS.interactiveCapsule} />
      </VStack>}
    </VStack>
  )
}

/** 已退出授权但 Token 仍在钥匙串：一键恢复或永久删除。 */
function PausedTokenCard({ info, actions }: { info: TokenInfo; actions: AccountActions }) {
  const kind = TOKEN_KIND_TITLE[info.kind]
  return (
    <VStack spacing={12} frame={{ maxWidth: "infinity" }}>
      <SectionTitle icon="key.horizontal" title="已保存的 Token" />
      <SettingRow icon="arrow.uturn.backward.circle" tint={MODE_STYLE.token.color} title="恢复授权浏览" subtitle={`使用钥匙串中的 ${kind.prefix}••••${info.suffix}`} action={() => { void actions.onResumeToken() }} />
      <SettingRow icon="trash" title="删除 Token" subtitle="从钥匙串永久删除" destructive action={() => { void actions.onDeleteToken() }} />
    </VStack>
  )
}

const TOKEN_KIND_TITLE: Record<TokenInfo["kind"], { title: string; prefix: string }> = {
  "fine-grained": { title: "Fine-grained", prefix: "github_pat_" },
  classic: { title: "Classic", prefix: "ghp_" },
  other: { title: "其他", prefix: "" },
}

function tokenNeedsAttention(info: TokenInfo | null): boolean {
  if (!info) return false
  const expiresSoon = info.expiresAt !== null && new Date(info.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60_000
  return expiresSoon || info.storage !== "passcode"
}

/** 设置页只保留一行入口；存储详情、管理操作与创建说明都在二级页。 */
function TokenSecurityRow({ info, failed, actions }: { info: TokenInfo | null; failed: boolean; actions: AccountActions }) {
  const warning = failed || tokenNeedsAttention(info)
  // 与「工具」其他行同样式；只在需要处理时附副标题提醒。
  const subtitle = failed ? "验证失败，轻点重新验证或更换" : warning ? "保护等级可提升或即将过期" : undefined
  return <SettingRow icon={warning ? "exclamationmark.shield" : "key"} tint={warning ? "systemOrange" : undefined} title="GitHub Token 管理" subtitle={subtitle} action={() => { void Navigation.present(<NavigationStack><TokenSecurityPage actions={actions} /></NavigationStack>) }} />
}

/** 二级页：存储状态 → 管理操作 → 创建说明。每次操作后重读元数据，Token 被删除则关闭。 */
function TokenSecurityPage({ actions }: { actions: AccountActions }) {
  const dismiss = Navigation.useDismiss()
  const [info, setInfo] = useState(readTokenInfo)
  const tint = MODE_STYLE.token.color

  async function run(action: () => Promise<void>) {
    await action()
    if (!hasGitHubToken()) {
      dismiss()
      return
    }
    setInfo(readTokenInfo())
  }

  return (
    <List
      listStyle="inset"
      scrollContentBackground="hidden"
      listRowBackground={<></>}
      listRowSeparator="hidden"
      background="systemGroupedBackground"
      navigationTitle="GitHub Token 管理"
      navigationBarTitleDisplayMode="inline"
      toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" systemImage="xmark" action={dismiss} /></ToolbarItem></Toolbar>}
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle icon="lock.shield" title="存储" />
          {info ? <TokenSecurityCard info={info} /> : null}
          {info && info.storage !== "passcode" ? <SettingRow icon="lock.badge.clock" tint="systemOrange" title="提升保护等级" subtitle="重新写入钥匙串，改为需设备密码才能读取" action={() => { void run(actions.onUpgradeTokenProtection) }} /> : null}
          <SectionTitle icon="slider.horizontal.3" title="管理" />
          <SettingRow icon="checkmark.shield" tint={tint} title="重新验证" subtitle="重新读取账户身份与过期时间" action={() => { void run(actions.onVerifyToken) }} />
          <SettingRow icon="key.horizontal" tint={tint} title="更换 Token" subtitle="保存前会先验证新 Token 是否有效" action={() => { void run(actions.onConfigureToken) }} />
          <SettingRow icon="rectangle.portrait.and.arrow.right" tint="systemOrange" title="退出授权" subtitle="改为公共浏览，Token 保留在钥匙串可随时恢复" action={() => { void run(actions.onSignOutToken) }} />
          <SettingRow icon="trash" title="删除 Token" subtitle="从钥匙串永久删除" destructive action={() => { void run(actions.onDeleteToken) }} />
          <SectionTitle icon="plus.circle" title="创建 Token" />
          <TokenGuide />
        </VStack>
      </Section>
    </List>
  )
}

/** 只展示元数据；完整 Token 只在钥匙串中，界面不显示也不提供导出。 */
function TokenSecurityCard({ info }: { info: TokenInfo }) {
  const kind = TOKEN_KIND_TITLE[info.kind]
  const expiresAt = info.expiresAt ? new Date(info.expiresAt) : null
  const expiresSoon = expiresAt !== null && expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60_000
  return (
    <VStack spacing={8} alignment="leading" padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
      <HStack spacing={8}>
        <Image systemName="key.fill" foregroundStyle="systemGreen" />
        <Text font={15} fontWeight="semibold">钥匙串加密存储</Text>
      </HStack>
      <TokenInfoLine label="类型" value={kind.title} />
      <TokenInfoLine label="标识" value={`${kind.prefix}••••${info.suffix}`} />
      <TokenInfoLine label="保护" value={info.storage === "passcode" ? "需设备密码 · 仅此设备 · 不同步 iCloud" : "解锁后可读 · 仅此设备 · 不同步 iCloud"} />
      <TokenInfoLine label="过期" value={expiresAt ? `${expiresAt.toLocaleDateString()}${expiresSoon ? "（即将过期）" : ""}` : info.verifiedAt ? "未设置过期或未返回" : "验证后显示"} color={expiresSoon ? "systemOrange" : undefined} />
      <TokenInfoLine label="验证" value={info.verifiedAt ? relativeTime(info.verifiedAt) : "尚未验证"} />
      <Text font={11} foregroundStyle="tertiaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{info.storage === "passcode" ? "关闭设备密码会使钥匙串中的 Token 失效，需要重新添加。" : "设置设备密码后可提升保护等级。"}脚本不会显示或导出完整 Token。</Text>
    </VStack>
  )
}

function TokenInfoLine({ label, value, color }: { label: string; value: string; color?: import("scripting").Color }) {
  return (
    <HStack spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font={13} foregroundStyle="secondaryLabel" frame={{ width: 36, alignment: "leading" }}>{label}</Text>
      <Text font={13} foregroundStyle={color ?? "label"} lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>{value}</Text>
    </HStack>
  )
}

/** 有完整资料时显示作者资料卡（与 Stars 页一致），模式徽章在类型胶囊旁、状态在底部；否则退回简版身份卡。 */
function IdentityHeader({ mode, account, login, status, warning = false, relation, headerAction, onOpenRepositories }: { mode: AccessMode; account: GitHubOwnerProfile | null; login: string; status: string | null; warning?: boolean; relation?: OwnerRelation; headerAction?: VirtualNode; onOpenRepositories: (login: string) => void }) {
  if (!account) return <IdentityCard mode={mode} account={null} login={login} status={status ?? ""} warning={warning} headerAction={headerAction} />
  return (
    <OwnerProfileCard
      profile={account}
      onOpenRepositories={() => onOpenRepositories(account.login)}
      relation={relation}
      headerAction={headerAction}
      trailingBadge={<ModeBadge mode={mode} />}
      accessory={status ? <Text font={12} foregroundStyle={warning ? "systemOrange" : "secondaryLabel"} lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>{status}</Text> : undefined}
    />
  )
}

function IdentityCard({ mode, account, login, status, warning = false, headerAction }: { mode: AccessMode; account: GitHubOwnerProfile | null; login: string; status: string; warning?: boolean; headerAction?: VirtualNode }) {
  const style = MODE_STYLE[mode]
  return (
    <HStack spacing={14} padding={{ horizontal: 16, vertical: 16 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
      {account ? (
        <Image imageUrl={account.avatarUrl} resizable={true} aspectRatio={{ contentMode: "fill" }} frame={{ width: 56, height: 56 }} clipShape="circle" />
      ) : (
        <Image systemName="person.crop.circle.fill" font={48} foregroundStyle={style.color} frame={{ width: 56, height: 56 }} />
      )}
      <VStack spacing={5} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <ModeBadge mode={mode} />
        <Text font={18} fontWeight="semibold" lineLimit={1}>{login}</Text>
        <Text font={12} foregroundStyle={warning ? "systemOrange" : "secondaryLabel"} multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{status}</Text>
      </VStack>
      {headerAction ?? null}
    </HStack>
  )
}

function TokenGuide() {
  return (
    <VStack spacing={12} alignment="leading" padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
      <VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={15} fontWeight="semibold" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>只需读取权限</Text>
        <Text font={13} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>本应用不会修改 GitHub 上的任何内容，建议只授予读取权限。</Text>
      </VStack>
      <TokenGuideItem title="Fine-grained（推荐）" permission="Repository access：Public repositories · Starring：Read-only" detail="浏览私有仓库时改选 All 或 Selected repositories，并加 Contents、Actions、Pull requests：Read-only。" />
      <TokenGuideItem title="Classic" permission="不勾选任何 scope" detail="可读取公开数据与你的 Star；需要私有仓库时勾选 repo。" />
    </VStack>
  )
}

function TokenGuideItem({ title, permission, detail }: { title: string; permission: string; detail: string }) {
  return (
    <VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font={15} fontWeight="semibold" frame={{ maxWidth: "infinity", alignment: "leading" }}>{title}</Text>
      <Text font={13} fontWeight="medium" foregroundStyle="systemGreen" frame={{ maxWidth: "infinity", alignment: "leading" }} multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{permission}</Text>
      <Text font={13} foregroundStyle="secondaryLabel" frame={{ maxWidth: "infinity", alignment: "leading" }} multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{detail}</Text>
    </VStack>
  )
}
