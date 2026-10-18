import {
  Button,
  HStack,
  Image,
  ProgressView,
  Rectangle,
  Text,
  VStack,
  ZStack,
} from "scripting"
import type { AccessMode, GitHubRepository } from "./types"

// One material system for every page: clear Glass derives its edge from the shared PageBackground.
const contentGlass = UIGlass.clear().interactive(false)
const controlGlass = UIGlass.clear().interactive(true)

export const GLASS = {
  content: { glass: contentGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  interactive: { glass: controlGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  capsule: { glass: contentGlass, shape: "capsule" as const },
  interactiveCapsule: { glass: controlGlass, shape: "capsule" as const },
} as const

export const DESIGN = {
  inset: 14,
  rowRadius: 16,
  controlRadius: 12,
  statusRadius: 18,
  touch: 44,
  iconSlot: 28,
  avatar: 42,
} as const

export function PageBackground({ children }: { children?: JSX.Element }) {
  if (!children) {
    return (
      <Rectangle
        fill="systemGroupedBackground"
        ignoresSafeArea={true}
        allowsHitTesting={false}
      />
    )
  }

  return (
    <ZStack
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      background="systemGroupedBackground"
    >
      {children}
    </ZStack>
  )
}

export const GITHUB_SYMBOL = "chevron.left.forwardslash.chevron.right"

/** Open GitHub in Scripting's in-app Safari without triggering the GitHub app Universal Link. */
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

/** 两种读取方式使用不同的主色与图标，让用户一眼区分当前所处状态；两者都只读。 */
export const MODE_STYLE: Record<AccessMode, { title: string; icon: string; color: import("scripting").Color }> = {
  token: { title: "授权浏览", icon: "checkmark.shield.fill", color: "systemGreen" },
  public: { title: "公共浏览", icon: "eye.fill", color: "systemBlue" },
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
  tint = "systemRed",
  destructive = false,
}: {
  icon: string
  title: string
  subtitle?: string
  action: () => void
  tint?: import("scripting").Color
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

export function StatusSurface({
  icon,
  title,
  detail,
  action,
  actionTitle = "重试",
  actionSystemImage = "arrow.clockwise",
  iconForegroundStyle = "systemBlue",
  isLoading = false,
}: {
  icon: string
  title: string
  detail: string
  action?: () => void
  actionTitle?: string
  actionSystemImage?: string
  iconForegroundStyle?: import("scripting").Color
  isLoading?: boolean
}) {
  return (
    <VStack
      spacing={10}
      alignment="center"
      padding={24}
      frame={{ maxWidth: "infinity" }}
      glassEffect={GLASS.content}
    >
      {isLoading ? (
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
    </VStack>
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

export function RepositoryMetadata({ icon, value, color = "secondaryLabel" }: { icon: string; value: string; color?: import("scripting").Color }) {
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

