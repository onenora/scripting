import {
  Button,
  HStack,
  Image,
  ProgressView,
  SVG,
  Spacer,
  Text,
  VStack,
  type Color,
} from "scripting"
import type { StoreScript } from "./store-api"
import { useUIFont } from "./ui-font"

// 与 GitHub Manager / XBS Converter 一致：透明玻璃 + 系统分组背景，颜色全部使用系统语义色。
const contentGlass = UIGlass.clear().interactive(false)
const controlGlass = UIGlass.clear().interactive(true)

export const GLASS = {
  content: { glass: contentGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  interactive: { glass: controlGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  capsule: { glass: contentGlass, shape: "capsule" as const },
  interactiveCapsule: { glass: controlGlass, shape: "capsule" as const },
} as const

export const ACCENT: Color = "systemOrange"

/** 卡片行：各自成为一行才能左滑，间距由 listRowInsets 控制。 */
export const CARD_ROW = {
  listRowBackground: <></>,
  listRowSeparator: "hidden" as const,
  listRowInsets: { top: 4, leading: 20, bottom: 4, trailing: 20 },
}

/** toolbar `principal` 占位：空 fragment 会被忽略，需要一个实际视图才能盖住系统标题。 */
export const HIDDEN_TITLE = <Spacer frame={{ width: 0, height: 0 }} />

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 页面标题区：代替系统大标题，使用界面字体并与卡片左边缘对齐。
 * 列表首个 Section 的唯一一行；页面同时把 toolbar 的 `principal` 设为 `HIDDEN_TITLE`，隐藏系统标题。
 */
export function PageHeader({ title, chip, chipIcon }: { title: string; chip?: string; chipIcon?: string }) {
  const font = useUIFont()
  return (
    <VStack spacing={8} alignment="leading" padding={{ horizontal: 4, bottom: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }} listRowBackground={<></>} listRowSeparator="hidden" listRowInsets={{ top: 0, leading: 20, bottom: 4, trailing: 20 }}>
      <Text font={font(30)} fontWeight="bold" foregroundStyle="label" lineLimit={2} minScaleFactor={0.7}>{title}</Text>
      {chip ? <Tag text={chip} icon={chipIcon} /> : null}
    </VStack>
  )
}

/** 分组标题行：图标、标题、简短状态左对齐，右侧放操作按钮。 */
export function SectionTitle({ icon, title, detail, action }: {
  icon: string
  title: string
  detail?: string
  action?: JSX.Element
}) {
  const font = useUIFont()
  return (
    <HStack spacing={8} padding={{ horizontal: 4, top: 4 }} frame={{ maxWidth: "infinity", minHeight: 32, alignment: "leading" }} listRowBackground={<></>} listRowSeparator="hidden">
      <Image systemName={icon} font={15} fontWeight="semibold" foregroundStyle={ACCENT} frame={{ width: 20 }} />
      <Text font={font(17)} fontWeight="semibold" foregroundStyle="label">{title}</Text>
      {detail ? <Text font={font(12)} foregroundStyle="secondaryLabel" lineLimit={1}>{detail}</Text> : null}
      <Spacer />
      {action ?? <Spacer frame={{ width: 32, height: 32 }} />}
    </HStack>
  )
}

export function Tag({ text, color = ACCENT, icon }: { text: string; color?: Color; icon?: string }) {
  const font = useUIFont()
  return (
    <HStack spacing={3} padding={{ horizontal: 8, vertical: 3 }} glassEffect={GLASS.capsule}>
      {icon ? <Image systemName={icon} font={10} fontWeight="semibold" foregroundStyle={color} /> : null}
      <Text font={font(11)} fontWeight="semibold" foregroundStyle={color} lineLimit={1}>{text}</Text>
    </HStack>
  )
}

function CapsuleLabel({ title, icon, prominent, color }: { title: string; icon: string; prominent: boolean; color?: Color }) {
  const tint: Color = color ?? (prominent ? ACCENT : "label")
  const font = useUIFont()
  return (
    <HStack spacing={6}>
      <Image systemName={icon} font={13} fontWeight="semibold" foregroundStyle={tint} />
      <Text font={font(14)} fontWeight={prominent ? "semibold" : "medium"} foregroundStyle={tint}>{title}</Text>
    </HStack>
  )
}

export function CapsuleButton({ title, icon, action, prominent = false, disabled = false, color }: {
  title: string
  icon: string
  action: () => void
  prominent?: boolean
  disabled?: boolean
  color?: Color
}) {
  return (
    <Button action={action} disabled={disabled} accessibilityLabel={title} buttonStyle="borderless" padding={{ horizontal: 14, vertical: 9 }} glassEffect={GLASS.interactiveCapsule}>
      <CapsuleLabel title={title} icon={icon} prominent={prominent} color={color} />
    </Button>
  )
}

/** 「获取」按钮，样式参照 App Store；`prominent` 为详情页的实心样式。 */
export function GetButton({ action, busy = false, prominent = false }: { action: () => void; busy?: boolean; prominent?: boolean }) {
  const font = useUIFont()
  const width = prominent ? 88 : 64
  if (busy) return <ProgressView progressViewStyle="circular" frame={{ minWidth: width, minHeight: 30 }} />
  return (
    <Button action={action} accessibilityLabel="获取" buttonStyle={prominent ? "glassProminent" : "glass"} buttonBorderShape="capsule" controlSize={prominent ? "regular" : "small"} tint={prominent ? ACCENT : undefined}>
      <Text font={font(prominent ? 16 : 14)} fontWeight="bold" foregroundStyle={prominent ? "white" : ACCENT} frame={{ minWidth: width - 28 }}>获取</Text>
    </Button>
  )
}

export function FootNote({ children }: { children: string }) {
  const font = useUIFont()
  return <Text font={font(12)} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }} padding={{ horizontal: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }} listRowBackground={<></>} listRowSeparator="hidden">{children}</Text>
}

export function StatusSurface({ icon, title, detail, loading = false, iconForegroundStyle = ACCENT, children }: {
  icon: string
  title: string
  detail: string
  loading?: boolean
  iconForegroundStyle?: Color
  /** 底部操作按钮，横向排列。 */
  children?: JSX.Element | JSX.Element[]
}) {
  const font = useUIFont()
  return (
    <VStack spacing={10} alignment="center" padding={24} frame={{ maxWidth: "infinity" }} glassEffect={GLASS.content} listRowBackground={<></>} listRowSeparator="hidden">
      {loading ? <ProgressView progressViewStyle="circular" /> : <Image systemName={icon} font={28} fontWeight="semibold" foregroundStyle={iconForegroundStyle} />}
      <Text font={font(17)} fontWeight="semibold" foregroundStyle="label">{title}</Text>
      <Text font={font(13)} foregroundStyle="secondaryLabel" multilineTextAlignment="center">{detail}</Text>
      {children ? <HStack spacing={10} padding={{ top: 4 }}>{children}</HStack> : null}
    </VStack>
  )
}

const SYMBOL_NAME = /^[a-z0-9]+(\.[a-z0-9]+)*$/

/** 脚本图标：SF Symbol → 图片 URL（含 SVG）→ emoji，均缺失时用占位符号。 */
export function ScriptIcon({ item, size }: { item: Pick<StoreScript, "symbol" | "icon">; size: number }) {
  const shape = { type: "rect" as const, cornerRadius: size * 0.24, style: "continuous" as const }
  const frame = { width: size, height: size }
  const icon = item.icon
  const symbol = item.symbol || (SYMBOL_NAME.test(icon) ? icon : "")

  let content: JSX.Element
  if (symbol) content = <Image systemName={symbol} font={size * 0.46} fontWeight="medium" foregroundStyle={ACCENT} />
  else if (/^https?:\/\/\S+\.svg(\?|$)/i.test(icon)) content = <SVG url={icon} resizable scaleToFit frame={{ width: size * 0.6, height: size * 0.6 }} />
  else if (/^(https?:\/\/|data:image\/)/i.test(icon)) content = <Image imageUrl={icon} resizable scaleToFill frame={frame} placeholder={<ProgressView progressViewStyle="circular" />} />
  else if (icon) content = <Text font={size * 0.5}>{icon}</Text>
  else content = <Image systemName="shippingbox" font={size * 0.46} fontWeight="medium" foregroundStyle={ACCENT} />

  return <VStack frame={frame} background="tertiarySystemFill" clipShape={shape}>{content}</VStack>
}
