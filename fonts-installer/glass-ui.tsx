import {
  Button,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
  type Color,
} from "scripting"
import { useUIFont } from "./ui-font"

// 各脚本共用的标准组件（见 STYLE.md），按需裁剪：透明玻璃 + 系统分组背景，颜色全部使用系统语义色。
const contentGlass = UIGlass.clear().interactive(false)
const controlGlass = UIGlass.clear().interactive(true)

export const GLASS = {
  content: { glass: contentGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  interactive: { glass: controlGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  capsule: { glass: contentGlass, shape: "capsule" as const },
  interactiveCapsule: { glass: controlGlass, shape: "capsule" as const },
} as const

export const ACCENT: Color = "systemIndigo"

/** 卡片行：各自成为一行才能左滑，间距由 listRowInsets 控制。 */
export const CARD_ROW = {
  listRowBackground: <></>,
  listRowSeparator: "hidden" as const,
  listRowInsets: { top: 4, leading: 20, bottom: 4, trailing: 20 },
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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

/** 卡片标题行右上角的小图标按钮，忙碌时显示进度。 */
export function HeaderIconButton({ icon, label, action, color = ACCENT, busy = false, disabled = false }: {
  icon: string
  label: string
  action: () => void
  color?: Color
  busy?: boolean
  disabled?: boolean
}) {
  if (busy) return <ProgressView progressViewStyle="circular" frame={{ width: 32, height: 32 }} accessibilityLabel={`${label}，进行中`} />
  return (
    <Button action={action} disabled={disabled} accessibilityLabel={label} buttonStyle="borderless" frame={{ minWidth: 32, minHeight: 32 }}>
      <Image systemName={icon} font={15} fontWeight="semibold" foregroundStyle={color} />
    </Button>
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

/** `color` 覆盖文字与图标颜色（如危险操作用 systemRed），默认 `prominent` 用主色、否则用 label。 */
export function CapsuleButton({ title, icon, action, prominent = false, disabled = false, color }: {
  title: string
  icon: string
  action: () => void
  prominent?: boolean
  disabled?: boolean
  color?: Color
}) {
  const font = useUIFont()
  const tint: Color = color ?? (prominent ? ACCENT : "label")
  return (
    <Button action={action} disabled={disabled} accessibilityLabel={title} buttonStyle="borderless" padding={{ horizontal: 14, vertical: 9 }} glassEffect={GLASS.interactiveCapsule}>
      <HStack spacing={6}>
        <Image systemName={icon} font={13} fontWeight="semibold" foregroundStyle={tint} />
        <Text font={font(14)} fontWeight={prominent ? "semibold" : "medium"} foregroundStyle={tint}>{title}</Text>
      </HStack>
    </Button>
  )
}

export function DetailRow({ label, value, onCopy, disabled = false }: {
  label: string
  value: string
  onCopy?: () => void
  disabled?: boolean
}) {
  const font = useUIFont()
  return (
    <HStack spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font={font(13)} foregroundStyle="secondaryLabel" frame={{ width: 76, alignment: "leading" }}>{label}</Text>
      <Text font={font(13)} foregroundStyle="label" lineLimit={1} truncationMode="tail" frame={{ maxWidth: "infinity", alignment: "leading" }}>{value}</Text>
      {onCopy ? (
        <Button action={onCopy} disabled={disabled} accessibilityLabel={`复制${label}`} buttonStyle="borderless" frame={{ minWidth: 28, minHeight: 28 }}>
          <Image systemName="doc.on.doc" font={13} foregroundStyle={ACCENT} />
        </Button>
      ) : null}
    </HStack>
  )
}

export function FootNote({ children }: { children: string }) {
  const font = useUIFont()
  return <Text font={font(12)} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }} padding={{ horizontal: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }} listRowBackground={<></>} listRowSeparator="hidden">{children}</Text>
}

/** 加载 / 空 / 错误三态卡片；`loading` 时图标换成进度圈。 */
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

export function formatRecordedAt(timestamp: number): string {
  if (!timestamp) return "未知时间"
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp))
}
