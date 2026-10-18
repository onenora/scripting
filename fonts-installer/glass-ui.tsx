import {
  Button,
  HStack,
  Image,
  ProgressView,
  Rectangle,
  Spacer,
  Text,
  VStack,
  type Color,
} from "scripting"

// 与 GitHub Manager 一致：透明玻璃 + 系统分组背景，颜色全部使用系统语义色。
const contentGlass = UIGlass.clear().interactive(false)
const controlGlass = UIGlass.clear().interactive(true)

export const GLASS = {
  content: { glass: contentGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  interactive: { glass: controlGlass, shape: { type: "rect" as const, cornerRadius: 16, style: "continuous" as const } },
  capsule: { glass: contentGlass, shape: "capsule" as const },
  interactiveCapsule: { glass: controlGlass, shape: "capsule" as const },
} as const

export const ACCENT: Color = "systemIndigo"

const UI_FONT_KEY = "fonts-installer.ui-font"
let uiFontName: string | null = Storage.get<string>(UI_FONT_KEY) ?? null

export function readUIFont(): string | null {
  return uiFontName
}

export function saveUIFont(name: string | null) {
  uiFontName = name
  if (name) Storage.set(UI_FONT_KEY, name)
  else Storage.remove(UI_FONT_KEY)
}

/** 界面文字字体：应用了已安装字体时使用该字体，否则为系统字体。字体预览页不使用。 */
export function uiFont(size: number): number | { name: string; size: number } {
  return uiFontName ? { name: uiFontName, size } : size
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function PageBackground() {
  return <Rectangle fill="systemGroupedBackground" ignoresSafeArea={true} allowsHitTesting={false} />
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
      <Text font={uiFont(17)} fontWeight="semibold" foregroundStyle="label">{title}</Text>
      {detail ? <Text font={uiFont(12)} foregroundStyle="secondaryLabel" lineLimit={1}>{detail}</Text> : null}
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

export function Tag({ text, color = ACCENT }: { text: string; color?: Color }) {
  return <Text font={uiFont(11)} fontWeight="semibold" foregroundStyle={color} padding={{ horizontal: 8, vertical: 3 }} glassEffect={GLASS.capsule}>{text}</Text>
}

export function CapsuleButton({ title, icon, action, prominent = false, disabled = false }: {
  title: string
  icon: string
  action: () => void
  prominent?: boolean
  disabled?: boolean
}) {
  const color: Color = prominent ? ACCENT : "label"
  return (
    <Button action={action} disabled={disabled} accessibilityLabel={title} buttonStyle="borderless" padding={{ horizontal: 14, vertical: 9 }} glassEffect={GLASS.interactiveCapsule}>
      <HStack spacing={6}>
        <Image systemName={icon} font={13} fontWeight="semibold" foregroundStyle={color} />
        <Text font={uiFont(14)} fontWeight={prominent ? "semibold" : "medium"} foregroundStyle={color}>{title}</Text>
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
  return (
    <HStack spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font={uiFont(13)} foregroundStyle="secondaryLabel" frame={{ width: 76, alignment: "leading" }}>{label}</Text>
      <Text font={uiFont(13)} foregroundStyle="label" lineLimit={1} truncationMode="tail" frame={{ maxWidth: "infinity", alignment: "leading" }}>{value}</Text>
      {onCopy ? (
        <Button action={onCopy} disabled={disabled} accessibilityLabel={`复制${label}`} buttonStyle="borderless" frame={{ minWidth: 28, minHeight: 28 }}>
          <Image systemName="doc.on.doc" font={13} foregroundStyle={ACCENT} />
        </Button>
      ) : null}
    </HStack>
  )
}

export function FootNote({ children }: { children: string }) {
  return <Text font={uiFont(12)} foregroundStyle="secondaryLabel" multilineTextAlignment="leading" fixedSize={{ horizontal: false, vertical: true }} padding={{ horizontal: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }} listRowBackground={<></>} listRowSeparator="hidden">{children}</Text>
}

export function StatusSurface({ icon, title, detail, action, actionTitle, actionSystemImage = "plus", iconForegroundStyle = ACCENT }: {
  icon: string
  title: string
  detail: string
  action?: () => void
  actionTitle?: string
  actionSystemImage?: string
  iconForegroundStyle?: Color
}) {
  return (
    <VStack spacing={10} alignment="center" padding={24} frame={{ maxWidth: "infinity" }} glassEffect={GLASS.content} listRowBackground={<></>} listRowSeparator="hidden">
      <Image systemName={icon} font={28} fontWeight="semibold" foregroundStyle={iconForegroundStyle} />
      <Text font={uiFont(17)} fontWeight="semibold" foregroundStyle="label">{title}</Text>
      <Text font={uiFont(13)} foregroundStyle="secondaryLabel" multilineTextAlignment="center">{detail}</Text>
      {action && actionTitle ? <CapsuleButton title={actionTitle} icon={actionSystemImage} action={action} prominent /> : null}
    </VStack>
  )
}

export function formatRecordedAt(timestamp: number): string {
  if (!timestamp) return "未知时间"
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp))
}
