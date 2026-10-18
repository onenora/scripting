import {
  Button,
  HStack,
  Image,
  Menu,
  ProgressView,
  Spacer,
  Text,
  VStack,
  type Color,
} from "scripting"

// 与 GitHub Manager / Fonts Installer 一致：透明玻璃 + 系统分组背景，颜色全部使用系统语义色。
const contentGlass = UIGlass.clear().interactive(false)
const controlGlass = UIGlass.clear().interactive(true)

export const GLASS = {
  content: { glass: contentGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  interactive: { glass: controlGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  capsule: { glass: contentGlass, shape: "capsule" as const },
  interactiveCapsule: { glass: controlGlass, shape: "capsule" as const },
} as const

export const ACCENT: Color = "systemTeal"

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

/** 标题行右侧的小图标按钮，忙碌时显示进度。 */
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

/** 标题行右侧的图标菜单。 */
export function HeaderIconMenu({ icon, label, children, disabled = false }: {
  icon: string
  label: string
  children: JSX.Element | JSX.Element[]
  disabled?: boolean
}) {
  return (
    <Menu disabled={disabled} menuIndicator="hidden" buttonStyle="borderless" frame={{ minWidth: 32, minHeight: 32 }} label={<Image systemName={icon} font={15} fontWeight="semibold" foregroundStyle={ACCENT} accessibilityLabel={label} />}>
      {children}
    </Menu>
  )
}

export function Tag({ text, color = ACCENT, icon }: { text: string; color?: Color; icon?: string }) {
  return (
    <HStack spacing={3} padding={{ horizontal: 8, vertical: 3 }} glassEffect={GLASS.capsule}>
      {icon ? <Image systemName={icon} font={10} fontWeight="semibold" foregroundStyle={color} /> : null}
      <Text font={11} fontWeight="semibold" foregroundStyle={color} lineLimit={1}>{text}</Text>
    </HStack>
  )
}

function CapsuleLabel({ title, icon, prominent }: { title: string; icon: string; prominent: boolean }) {
  const color: Color = prominent ? ACCENT : "label"
  return (
    <HStack spacing={6}>
      <Image systemName={icon} font={13} fontWeight="semibold" foregroundStyle={color} />
      <Text font={14} fontWeight={prominent ? "semibold" : "medium"} foregroundStyle={color}>{title}</Text>
    </HStack>
  )
}

export function CapsuleButton({ title, icon, action, prominent = false, disabled = false }: {
  title: string
  icon: string
  action: () => void
  prominent?: boolean
  disabled?: boolean
}) {
  return (
    <Button action={action} disabled={disabled} accessibilityLabel={title} buttonStyle="borderless" padding={{ horizontal: 14, vertical: 9 }} glassEffect={GLASS.interactiveCapsule}>
      <CapsuleLabel title={title} icon={icon} prominent={prominent} />
    </Button>
  )
}

/** 外观同 CapsuleButton，点按展开菜单。 */
export function CapsuleMenu({ title, icon, children, prominent = false, disabled = false }: {
  title: string
  icon: string
  children: JSX.Element | JSX.Element[]
  prominent?: boolean
  disabled?: boolean
}) {
  return (
    <Menu disabled={disabled} menuIndicator="hidden" menuStyle="button" buttonStyle="borderless" padding={{ horizontal: 14, vertical: 9 }} glassEffect={GLASS.interactiveCapsule} label={<CapsuleLabel title={title} icon={icon} prominent={prominent} />}>
      {children}
    </Menu>
  )
}

export function DetailRow({ label, value, monospaced = false }: { label: string; value: string; monospaced?: boolean }) {
  return (
    <HStack spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font={13} foregroundStyle="secondaryLabel" frame={{ width: 64, alignment: "leading" }}>{label}</Text>
      <Text font={13} monospaced={monospaced} foregroundStyle="label" lineLimit={1} truncationMode="middle" frame={{ maxWidth: "infinity", alignment: "leading" }}>{value}</Text>
    </HStack>
  )
}

export function FootNote({ children }: { children: string }) {
  return <Text font={12} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }} padding={{ horizontal: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }} listRowBackground={<></>} listRowSeparator="hidden">{children}</Text>
}

export function StatusSurface({ icon, title, detail, iconForegroundStyle = ACCENT, children }: {
  icon: string
  title: string
  detail: string
  iconForegroundStyle?: Color
  /** 底部操作按钮，横向排列。 */
  children?: JSX.Element | JSX.Element[]
}) {
  return (
    <VStack spacing={10} alignment="center" padding={24} frame={{ maxWidth: "infinity" }} glassEffect={GLASS.content} listRowBackground={<></>} listRowSeparator="hidden">
      <Image systemName={icon} font={28} fontWeight="semibold" foregroundStyle={iconForegroundStyle} />
      <Text font={17} fontWeight="semibold" foregroundStyle="label">{title}</Text>
      <Text font={13} foregroundStyle="secondaryLabel" multilineTextAlignment="center">{detail}</Text>
      {children ? <HStack spacing={10} padding={{ top: 4 }}>{children}</HStack> : null}
    </VStack>
  )
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp))
}
