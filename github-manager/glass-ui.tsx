import {
  Button,
  HStack,
  Image,
  ProgressView,
  Rectangle,
  Script,
  Spacer,
  Text,
  VStack,
  ZStack,
  type Color,
} from "scripting"
import type { AccessMode, GitHubRepository } from "./types"

// 各脚本共用的标准组件（见 STYLE.md），加上本脚本的仓库与模式组件：透明玻璃 + 系统分组背景，颜色全部使用系统语义色。
export const ACCENT: Color = "systemBlue"

const contentGlass = UIGlass.clear().interactive(false)
const controlGlass = UIGlass.clear().interactive(true)

export const GLASS = {
  content: { glass: contentGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  interactive: { glass: controlGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  capsule: { glass: contentGlass, shape: "capsule" as const },
  interactiveCapsule: { glass: controlGlass, shape: "capsule" as const },
} as const

/** 仓库浏览页的尺寸：行内边距、行圆角（与 GLASS 一致）、触控尺寸、图标槽宽。 */
export const DESIGN = {
  inset: 14,
  rowRadius: 16,
  touch: 44,
  iconSlot: 28,
} as const

/** 卡片行：各自成为一行才能左滑，间距由 listRowInsets 控制。 */
export const CARD_ROW = {
  listRowBackground: <></>,
  listRowSeparator: "hidden" as const,
  listRowInsets: { top: 4, leading: 20, bottom: 4, trailing: 20 },
}

/** 只用于主页 TabView 底层：标签栏与侧边栏后面也要铺满分组背景。列表页直接设 `background="systemGroupedBackground"`。 */
export function PageBackground() {
  return <Rectangle fill="systemGroupedBackground" ignoresSafeArea={true} allowsHitTesting={false} />
}

export const GITHUB_SYMBOL = "chevron.left.forwardslash.chevron.right"

/** 在 Scripting 内置 Safari 打开 GitHub 页面，避免跳转到 GitHub App。 */
export async function openGitHubWebPage(url: string, _title = "GitHub") {
  await Safari.present(url, true)
}

export function GitHubIcon({ size = 17 }: { size?: number } = {}) {
  return <Image systemName={GITHUB_SYMBOL} font={size} fontWeight="semibold" foregroundStyle="label" />
}

export function IconButton({
  icon,
  label,
  action,
  navigationDestination,
}: {
  icon: string
  label: string
  action: () => void
  navigationDestination?: {
    isPresented: boolean
    onChanged: (isPresented: boolean) => void
    content: JSX.Element
  }
}) {
  return (
    <Button
      action={action}
      accessibilityLabel={label}
      buttonStyle="plain"
      navigationDestination={navigationDestination}
      frame={{ minWidth: 44, minHeight: 44 }}
    >
      <Image systemName={icon} font={17} fontWeight="semibold" foregroundStyle="label" />
    </Button>
  )
}

/** 分组标题行：图标、标题、简短状态左对齐，右侧放操作按钮。 */
export function SectionTitle({ icon, title, detail, action }: {
  icon: string
  title: string
  detail?: string
  action?: JSX.Element
}) {
  return (
    <HStack spacing={8} padding={{ horizontal: 4, top: 4 }} frame={{ maxWidth: "infinity", minHeight: 32, alignment: "leading" }} listRowBackground={<></>} listRowSeparator="hidden">
      <Image systemName={icon} font={15} fontWeight="semibold" foregroundStyle={ACCENT} frame={{ width: 20 }} />
      <Text font={17} fontWeight="semibold" foregroundStyle="label">{title}</Text>
      {detail ? <Text font={12} foregroundStyle="secondaryLabel" lineLimit={1}>{detail}</Text> : null}
      <Spacer />
      {action ?? <Spacer frame={{ width: 32, height: 32 }} />}
    </HStack>
  )
}

/** 卡片标题行右上角的小图标按钮，样式与标题前的符号一致。 */
export function HeaderIconButton({ icon, label, action, color = ACCENT }: { icon: string; label: string; action: () => void; color?: Color }) {
  return (
    <Button action={action} accessibilityLabel={label} buttonStyle="borderless" frame={{ minWidth: 32, minHeight: 32 }}>
      <Image systemName={icon} font={15} fontWeight="semibold" foregroundStyle={color} />
    </Button>
  )
}

/** 两种读取方式使用不同的主色与图标，让用户一眼区分当前所处状态；两者都只读。 */
export const MODE_STYLE: Record<AccessMode, { title: string; icon: string; color: Color }> = {
  token: { title: "授权浏览", icon: "checkmark.shield.fill", color: "systemGreen" },
  public: { title: "公共浏览", icon: "eye.fill", color: ACCENT },
  none: { title: "未连接", icon: "person.crop.circle.badge.questionmark", color: "systemOrange" },
}

export function ModeBadge({ mode }: { mode: AccessMode }) {
  const style = MODE_STYLE[mode]
  return (
    <HStack spacing={4} padding={{ horizontal: 9, vertical: 4 }} glassEffect={GLASS.capsule} accessibilityLabel={`当前模式：${style.title}`}>
      <Image systemName={style.icon} font={11} fontWeight="semibold" foregroundStyle={style.color} />
      <Text font={12} fontWeight="semibold" foregroundStyle={style.color}>{style.title}</Text>
    </HStack>
  )
}

export function CapabilityLine({ enabled, text }: { enabled: boolean; text: string }) {
  return (
    <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Image systemName={enabled ? "checkmark.circle.fill" : "lock.fill"} font={13} foregroundStyle={enabled ? "systemGreen" : "tertiaryLabel"} frame={{ width: 18 }} />
      <Text font={13} foregroundStyle={enabled ? "label" : "secondaryLabel"} frame={{ maxWidth: "infinity", alignment: "leading" }} multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{text}</Text>
    </HStack>
  )
}

export function SettingRow({
  icon,
  title,
  subtitle,
  action,
  tint = ACCENT,
  destructive = false,
}: {
  icon: string
  title: string
  subtitle?: string
  action: () => void
  tint?: Color
  destructive?: boolean
}) {
  return (
    <Button
      action={action}
      role={destructive ? "destructive" : undefined}
      accessibilityLabel={title}
      buttonStyle="plain"
      frame={{ maxWidth: "infinity", minHeight: 52, alignment: "leading" }}
      padding={{ horizontal: 16, vertical: subtitle ? 8 : 0 }}
      glassEffect={GLASS.interactive}
      glassEffectTransition="materialize"
    >
      <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Image systemName={icon} foregroundStyle={destructive ? "systemRed" : tint} frame={{ width: 22 }} />
        <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text foregroundStyle={destructive ? "systemRed" : "label"}>{title}</Text>
          {subtitle ? <Text font={12} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{subtitle}</Text> : null}
        </VStack>
      </HStack>
    </Button>
  )
}

export function errorStatusDetail(reason: string, nextStep = "请检查网络连接或 GitHub Token 是否有效后重试。"): string {
  return `原因：${reason}\n下一步：${nextStep}`
}

/** 加载 / 空 / 错误三态卡片；`loading` 时图标换成进度圈。`action` 是常用的「重试」按钮，其他操作放进 children。 */
export function StatusSurface({
  icon,
  title,
  detail,
  action,
  actionTitle = "重试",
  actionSystemImage = "arrow.clockwise",
  iconForegroundStyle = ACCENT,
  loading = false,
  children,
}: {
  icon: string
  title: string
  detail: string
  action?: () => void
  actionTitle?: string
  actionSystemImage?: string
  iconForegroundStyle?: Color
  loading?: boolean
  children?: JSX.Element | JSX.Element[]
}) {
  return (
    <VStack
      spacing={10}
      alignment="center"
      padding={24}
      frame={{ maxWidth: "infinity" }}
      glassEffect={GLASS.content}
    >
      {loading ? (
        <ProgressView
          progressViewStyle="circular"
          tint={iconForegroundStyle}
          frame={{ width: 32, height: 32 }}
          accessibilityLabel={`${title}，进行中`}
        />
      ) : (
        <Image systemName={icon} font={28} fontWeight="semibold" foregroundStyle={iconForegroundStyle} />
      )}
      <Text font={17} fontWeight="semibold" foregroundStyle="label">{title}</Text>
      <Text font={13} foregroundStyle="secondaryLabel" multilineTextAlignment="center">{detail}</Text>
      {action ? (
        <Button
          action={action}
          buttonStyle="borderless"
          padding={{ horizontal: 14, vertical: 10 }}
          glassEffect={GLASS.interactiveCapsule}
          accessibilityLabel={actionTitle}
        >
          <HStack spacing={6} alignment="center">
            <Image systemName={actionSystemImage} font={14} fontWeight="semibold" />
            <Text font={15} fontWeight="medium">{actionTitle}</Text>
          </HStack>
        </Button>
      ) : null}
      {children ? <HStack spacing={10} padding={{ top: 4 }}>{children}</HStack> : null}
    </VStack>
  )
}

/** 设置页末尾的关于卡片：脚本图标、名称与版本，下方放 AboutLine。 */
export function AboutCard({ children }: { children?: JSX.Element | JSX.Element[] }) {
  const { metadata } = Script
  return (
    <VStack spacing={14} alignment="leading" padding={16} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
      <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Image systemName={metadata.icon} font={22} fontWeight="semibold" foregroundStyle={ACCENT} frame={{ width: 44, height: 44 }} glassEffect={GLASS.content} />
        <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={17} fontWeight="semibold" foregroundStyle="label">{metadata.localizedName || metadata.name}</Text>
          <Text font={13} foregroundStyle="secondaryLabel">版本 {metadata.version}</Text>
        </VStack>
      </HStack>
      {children}
    </VStack>
  )
}

export function AboutLine({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <HStack spacing={12} alignment="top" frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Image systemName={icon} font={15} foregroundStyle="secondaryLabel" frame={{ width: 22 }} />
      <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={14} fontWeight="medium" foregroundStyle="label">{title}</Text>
        <Text font={13} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }}>{detail}</Text>
      </VStack>
    </HStack>
  )
}

export function RepositoryIcon({ repository, size }: { repository: GitHubRepository; size: number }) {
  const inset = 3
  const frameShape = { type: "rect" as const, cornerRadius: Math.round(size * 0.24) }
  const imageSize = size - inset * 2
  const imageShape = { type: "rect" as const, cornerRadius: Math.max(4, Math.round(size * 0.17)) }

  return (
    <ZStack
      frame={{ width: size, height: size }}
      clipShape={frameShape}
    >
      <Image
        imageUrl={repository.owner.avatarUrl}
        resizable={true}
        aspectRatio={{ contentMode: "fit" }}
        frame={{ width: imageSize, height: imageSize }}
        clipped={true}
        clipShape={imageShape}
      />
    </ZStack>
  )
}

export function RepositoryMetadata({ icon, value, color = "secondaryLabel" }: { icon: string; value: string; color?: Color }) {
  return (
    <HStack spacing={5} alignment="center" frame={{ alignment: "leading" }}>
      <Image systemName={icon} font={11} fontWeight="semibold" foregroundStyle="secondaryLabel" frame={{ width: 14, alignment: "center" }} />
      <Text font={12} fontWeight="medium" foregroundStyle={color} lineLimit={1} frame={{ alignment: "leading" }}>
        {value}
      </Text>
    </HStack>
  )
}

export function relativeTime(isoDate: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000))
  if (seconds < 60) return "刚刚"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} 个月前`
  return `${Math.floor(months / 12)} 年前`
}

export function compactNumber(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1000000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`
  return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`
}

