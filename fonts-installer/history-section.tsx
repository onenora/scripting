import { Button, HStack, Image, Section, Text, VStack, useState } from "scripting"
import { recordPickedFont, removeFontHistoryEntry, type FontHistoryEntry } from "./font-history"
import { ACCENT, CARD_ROW, errorMessage, FootNote, formatRecordedAt, GLASS, HeaderIconButton, SectionTitle, Tag } from "./glass-ui"
import { presentInstalledFontPreview } from "./installed-font-preview"
import { setFontName, useFontName, useUIFont } from "./ui-font"

/** 安装历史：本脚本安装过的字体，以及从系统 FontPicker 加入的已安装字体；每条记录单独成行以支持左滑删除或应用为界面字体。 */
export function HistorySection({ entries, onChange }: {
  entries: FontHistoryEntry[]
  onChange: (entries: FontHistoryEntry[]) => void
}) {
  const appliedFont = useFontName()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const summary = status ?? (entries.length ? `${entries.length} 条` : "暂无记录")

  async function pickInstalledFont() {
    if (busy) return
    setBusy(true)
    try {
      const fontName = await FontPicker.pickFont()
      if (!fontName) return
      onChange(recordPickedFont(fontName))
      setStatus(`已加入：${fontName}`)
      HapticFeedback.notificationSuccess()
    } catch (error) {
      await Dialog.alert({ title: "无法打开字体选择器", message: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function preview(entry: FontHistoryEntry) {
    try {
      await presentInstalledFontPreview(entry.postScriptName, entry.supportsChinese === true)
    } catch (error) {
      await Dialog.alert({ title: "无法预览字体", message: errorMessage(error) })
    }
  }

  async function remove(entry: FontHistoryEntry) {
    try {
      onChange(removeFontHistoryEntry(entry.postScriptName))
      // 删除正在使用的字体记录时一并还原，避免没有入口还原系统字体。
      if (entry.postScriptName === appliedFont) setFontName(null)
      setStatus(`已删除：${entry.fullName}`)
    } catch (error) {
      await Dialog.alert({ title: "无法删除字体记录", message: errorMessage(error) })
    }
  }

  function apply(entry: FontHistoryEntry | null) {
    setFontName(entry?.postScriptName ?? null)
    setStatus(entry ? `界面字体：${entry.fullName}` : "已还原系统字体")
    HapticFeedback.notificationSuccess()
  }

  async function copy(fontName: string) {
    try {
      await Pasteboard.setString(fontName)
      setStatus(`已复制：${fontName}`)
      HapticFeedback.notificationSuccess()
    } catch (error) {
      await Dialog.alert({ title: "无法复制字体名称", message: errorMessage(error) })
    }
  }

  return (
    <Section listRowBackground={<></>} listRowSeparator="hidden">
      <SectionTitle icon="clock.arrow.circlepath" title="安装历史" detail={summary} action={<HeaderIconButton icon="plus" label="添加系统已安装字体" busy={busy} action={() => void pickInstalledFont()} />} />
      {entries.map(entry => (
        <HistoryRow
          key={entry.postScriptName}
          entry={entry}
          applied={entry.postScriptName === appliedFont}
          onPreview={() => void preview(entry)}
          onCopy={() => void copy(entry.postScriptName)}
          onDelete={() => void remove(entry)}
          onApply={() => apply(entry.postScriptName === appliedFont ? null : entry)}
        />
      ))}
      <FootNote>安装过的字体会记录在这里，右上角 + 可添加系统已安装字体。只保存名称等信息，不保存字体文件；轻点预览，左滑可删除记录或应用为界面字体，删除不会卸载字体。</FootNote>
    </Section>
  )
}

function HistoryRow({ entry, applied, onPreview, onCopy, onDelete, onApply }: {
  entry: FontHistoryEntry
  applied: boolean
  onPreview: () => void
  onCopy: () => void
  onDelete: () => void
  onApply: () => void
}) {
  const font = useUIFont()
  const installed = entry.source === "installer"
  const detail = [entry.styleName, formatRecordedAt(entry.recordedAt)].filter(Boolean).join(" · ")
  return (
    <HStack
      spacing={10}
      padding={{ horizontal: 14, vertical: 10 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      glassEffect={GLASS.interactive}
      {...CARD_ROW}
      trailingSwipeActions={{
        actions: [
          <Button title="删除" systemImage="trash" role="destructive" action={onDelete} />,
          applied
            ? <Button title="还原" systemImage="arrow.uturn.backward" tint="systemGray" action={onApply} />
            : <Button title="应用" systemImage="checkmark.circle" tint={ACCENT} action={onApply} />,
        ],
      }}
    >
      <Button action={onPreview} buttonStyle="borderless" accessibilityLabel={`预览 ${entry.fullName}`} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Image systemName="f.cursive" font={18} fontWeight="semibold" foregroundStyle={installed ? "systemGreen" : ACCENT} frame={{ width: 28 }} />
          <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <HStack spacing={6}>
              <Text font={font(15)} fontWeight="semibold" foregroundStyle="label" lineLimit={1}>{entry.fullName}</Text>
              <Tag text={installed ? "安装" : "系统"} color={installed ? "systemGreen" : ACCENT} icon={installed ? "checkmark.shield" : "iphone"} />
              {applied ? <Tag text="界面使用中" color="systemOrange" icon="paintbrush" /> : null}
            </HStack>
            <Text font={font(12)} foregroundStyle="secondaryLabel" lineLimit={1}>{entry.postScriptName}</Text>
            <Text font={font(11)} foregroundStyle="tertiaryLabel" lineLimit={1}>{detail}</Text>
          </VStack>
        </HStack>
      </Button>
      <Button action={onCopy} buttonStyle="borderless" accessibilityLabel={`复制 ${entry.postScriptName}`} frame={{ minWidth: 36, minHeight: 36 }}>
        <Image systemName="doc.on.doc" font={15} foregroundStyle={ACCENT} />
      </Button>
    </HStack>
  )
}
