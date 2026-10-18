import { Button, HStack, Image, Path, Section, Spacer, Text, VStack, useState } from "scripting"
import { formatFileSize, inspectFontFileVariants, type InspectedFont } from "./font"
import { prepareFontForInstall } from "./font-instance"
import { recordInstalledFont, type FontHistoryEntry } from "./font-history"
import { ACCENT, CapsuleButton, DetailRow, errorMessage, FootNote, GLASS, HeaderIconButton, SectionTitle, StatusSurface, Tag, uiFont } from "./glass-ui"
import { openFontInstaller } from "./profile"
import { presentFontPreview } from "./preview"

/**
 * 导入字体文件，逐个预览或生成描述文件安装；安装成功后写入字体历史。
 * `appliedFont` 只用于切换界面字体时触发重绘（Scripting 只重绘 props 变化的组件），字体本身由 `uiFont()` 读取。
 */
export function InstallSection({ onHistoryChange }: { onHistoryChange: (entries: FontHistoryEntry[]) => void; appliedFont: string | null }) {
  const [fonts, setFonts] = useState<InspectedFont[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")

  async function run(task: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }

  async function copy(value: string, label: string) {
    try {
      await Pasteboard.setString(value)
      setStatus(`已复制${label}：${value}`)
      HapticFeedback.notificationSuccess()
    } catch (error) {
      await Dialog.alert({ title: `无法复制${label}`, message: errorMessage(error) })
    }
  }

  const importFonts = () => run(async () => {
    setStatus("正在读取字体…")
    try {
      const paths = await DocumentPicker.pickFiles({ types: ["public.font"], allowsMultipleSelection: true, shouldShowFileExtensions: true })
      if (!paths.length) {
        setStatus(fonts.length ? "已保留当前字体" : "未选择字体")
        return
      }
      const imported: InspectedFont[] = []
      const failures: string[] = []
      for (const path of paths) {
        try {
          imported.push(...await inspectFontFileVariants(path))
        } catch (error) {
          failures.push(`${Path.basename(path)}：${errorMessage(error)}`)
        }
      }
      if (!imported.length) throw new Error(failures[0] ?? "没有可用的字体文件。")
      setFonts(imported)
      setStatus(`已导入 ${imported.length} 个字体，可逐个预览或安装`)
      HapticFeedback.notificationSuccess()
      if (failures.length) {
        await Dialog.alert({ title: "部分字体未导入", message: `成功 ${imported.length} 个，失败 ${failures.length} 个。\n\n${failures.join("\n")}` })
      }
    } catch (error) {
      setStatus("导入失败")
      await Dialog.alert({ title: "无法导入字体", message: errorMessage(error) })
    }
  })

  // 取消只移出待安装列表，全部取消后回到导入卡片。
  function cancelFont(selected: InspectedFont) {
    const next = fonts.filter(font => font !== selected)
    setFonts(next)
    setStatus(next.length ? `已取消：${selected.info.fullName}` : "")
  }

  const previewFont = (selected: InspectedFont) => run(async () => {
    try {
      await presentFontPreview(selected.info, selected.data)
    } catch (error) {
      await Dialog.alert({ title: "无法预览字体", message: errorMessage(error) })
    }
  })

  const installFont = (selected: InspectedFont) => run(async () => {
    setStatus(selected.info.variation ? "正在生成独立字重…" : "正在生成配置描述文件…")
    try {
      const font = await prepareFontForInstall(selected)
      setStatus("正在生成配置描述文件…")
      await openFontInstaller(font.info, font.data)
      setStatus("描述文件已交给系统，请在「设置」中确认安装")
      HapticFeedback.notificationSuccess()
      try {
        onHistoryChange(recordInstalledFont(font.info))
      } catch (historyError) {
        setStatus("描述文件已交给系统，但历史记录保存失败")
        await Dialog.alert({ title: "安装请求已发出", message: `系统已接收描述文件，但无法保存字体历史：${errorMessage(historyError)}` })
      }
    } catch (error) {
      setStatus("安装请求失败")
      await Dialog.alert({ title: "无法开始安装", message: errorMessage(error) })
    }
  })

  return (
    <Section listRowBackground={<></>} listRowSeparator="hidden">
      <SectionTitle
        icon="square.and.arrow.down"
        title="字体安装"
        detail={fonts.length ? `${fonts.length} 个` : undefined}
        // 空状态卡片已有导入按钮，导入后才在右上角提供更换入口。
        action={fonts.length || busy ? <HeaderIconButton icon="plus" label="更换字体" busy={busy} action={() => void importFonts()} /> : undefined}
      />
      {fonts.length === 0
        ? <StatusSurface icon="doc.badge.plus" title="导入字体" detail="可多选 .ttf / .otf，不支持 .ttc / .otc 字体集合。" actionTitle="选择字体文件" actionSystemImage="square.and.arrow.down" action={() => void importFonts()} />
        : null}
      {/* 每个字体单独成行，才能左滑取消。 */}
      {fonts.map((selected, index) => (
        <FontCard
          key={`${selected.info.postScriptName}-${index}`}
          item={selected}
          busy={busy}
          onCopy={(value, label) => void copy(value, label)}
          onPreview={() => void previewFont(selected)}
          onInstall={() => void installFont(selected)}
          onCancel={() => cancelFont(selected)}
        />
      ))}
      {status ? <Text font={uiFont(12)} foregroundStyle="secondaryLabel" lineLimit={2} frame={{ maxWidth: "infinity", alignment: "center" }} listRowBackground={<></>} listRowSeparator="hidden">{status}</Text> : null}
      <FootNote>点按「安装到系统」后，iOS 会接管配置描述文件，请按系统提示在「设置」中确认安装；删除字体也需在「设置」的描述文件页面移除。</FootNote>
    </Section>
  )
}

function FontCard({ item, busy, onCopy, onPreview, onInstall, onCancel }: {
  item: InspectedFont
  busy: boolean
  onCopy: (value: string, label: string) => void
  onPreview: () => void
  onInstall: () => void
  onCancel: () => void
}) {
  const info = item.info
  return (
    <VStack
      spacing={12}
      padding={{ horizontal: 16, vertical: 14 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      glassEffect={GLASS.content}
      listRowBackground={<></>}
      listRowSeparator="hidden"
      listRowInsets={{ top: 4, leading: 20, bottom: 4, trailing: 20 }}
      trailingSwipeActions={{ actions: [<Button title="取消" systemImage="xmark" role="destructive" disabled={busy} action={onCancel} />] }}
    >
      <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Image systemName="f.cursive" font={20} fontWeight="semibold" foregroundStyle={ACCENT} frame={{ width: 28 }} />
        <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={uiFont(16)} fontWeight="semibold" foregroundStyle="label" lineLimit={1}>{info.fullName}</Text>
          <Text font={uiFont(12)} foregroundStyle="secondaryLabel" lineLimit={1}>{`${info.fileName} · ${info.format} · ${formatFileSize(info.fileSize)}`}</Text>
        </VStack>
        {info.variation ? <Tag text="可变字重" color="systemPurple" /> : <Tag text="已验证" color="systemGreen" />}
      </HStack>
      <VStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <DetailRow label="字体家族" value={info.familyName} onCopy={() => onCopy(info.familyName, "字体家族")} />
        <DetailRow label="样式" value={info.styleName} />
        <DetailRow label="PostScript" value={info.postScriptName} onCopy={() => onCopy(info.postScriptName, "PostScript 名称")} />
      </VStack>
      <HStack spacing={10} frame={{ maxWidth: "infinity" }}>
        <CapsuleButton title="预览" icon="character.book.closed" disabled={busy} action={onPreview} />
        <Spacer />
        <CapsuleButton title="安装到系统" icon="checkmark.shield" prominent disabled={busy} action={onInstall} />
      </HStack>
    </VStack>
  )
}
