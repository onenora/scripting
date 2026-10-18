import {
  Button,
  HStack,
  Image,
  Navigation,
  NavigationStack,
  Path,
  Picker,
  ProgressView,
  Text,
  VStack,
  WebView,
  ZStack,
  useEffect,
  useMemo,
  useState,
} from "scripting"
import { formatFileSize, type FontInfo } from "./font"
import { prepareFontForInstall } from "./font-instance"
import { recordInstalledFont } from "./font-history"
import { ACCENT, CapsuleButton, DetailRow, errorMessage, GLASS, PageBackground, uiFont } from "./glass-ui"
import { openFontInstaller } from "./profile"
import { createFontPreviewHTML } from "./preview"

type PreviewState = "loading" | "ready" | { status: "error"; message: string }

/** 快捷指令 / 分享表单传入单个字体：多字重时顶部切换，预览后安装。 */
export function SharedFontInstallView({ fonts, previewDirectory, fontFileName }: {
  fonts: FontInfo[]
  previewDirectory: string
  fontFileName: string
}) {
  const dismiss = Navigation.useDismiss()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const controller = useMemo(() => new WebViewController({ ephemeral: true }), [selectedIndex])
  const selectedFont = fonts[selectedIndex]
  const [previewState, setPreviewState] = useState<PreviewState>("loading")
  const [installing, setInstalling] = useState(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const previewReady = previewState === "ready"

  useEffect(() => {
    return () => controller.dispose()
  }, [controller])

  useEffect(() => {
    let active = true
    setPreviewState("loading")

    const loadPreview = async () => {
      try {
        const html = createFontPreviewHTML(selectedFont, null, { embedded: true, fontURL: fontFileName })
        const htmlPath = Path.join(previewDirectory, `preview-${selectedIndex}.html`)
        await FileManager.writeAsString(htmlPath, html, "utf-8")
        const loaded = await controller.loadFile(htmlPath, previewDirectory)
        if (!loaded) throw new Error("无法载入字体预览。")
        if (active) setPreviewState("ready")
      } catch (error) {
        if (active) setPreviewState({ status: "error", message: errorMessage(error) })
      }
    }

    void loadPreview()
    return () => {
      active = false
    }
  }, [controller, selectedFont, selectedIndex, previewDirectory, fontFileName])

  const copyFontValue = async (value: string, label: string) => {
    try {
      await Pasteboard.setString(value)
      setCopyMessage(`已复制${label}`)
      HapticFeedback.notificationSuccess()
    } catch (error) {
      await Dialog.alert({ title: `无法复制${label}`, message: errorMessage(error) })
    }
  }

  const installFont = async () => {
    if (!previewReady || installing) return
    setInstalling(true)
    try {
      const data = await FileManager.readAsData(Path.join(previewDirectory, fontFileName))
      const font = await prepareFontForInstall({ info: selectedFont, data })
      await openFontInstaller(font.info, font.data)
      HapticFeedback.notificationSuccess()
      try {
        recordInstalledFont(font.info)
      } catch (historyError) {
        await Dialog.alert({ title: "安装请求已发出", message: `系统已接收描述文件，但无法保存字体历史：${errorMessage(historyError)}` })
      }
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: "无法开始安装", message: errorMessage(error) })
      setInstalling(false)
    }
  }

  return (
    <NavigationStack>
      <ZStack
        navigationTitle="预览并安装"
        navigationBarTitleDisplayMode="inline"
        toolbar={{ cancellationAction: <Button title="取消" action={() => dismiss()} /> }}
      >
        <PageBackground />
        <VStack spacing={12} padding={{ top: 12, bottom: 16, horizontal: 16 }} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
          <VStack spacing={10} padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
            <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Image systemName="f.cursive" font={20} fontWeight="semibold" foregroundStyle={ACCENT} frame={{ width: 28 }} />
              <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
                <Text font={uiFont(16)} fontWeight="semibold" foregroundStyle="label" lineLimit={1}>{selectedFont.fullName}</Text>
                <Text font={uiFont(12)} foregroundStyle="secondaryLabel" lineLimit={1}>{`${selectedFont.format} · ${formatFileSize(selectedFont.fileSize)}`}</Text>
              </VStack>
              {fonts.length > 1 ? (
                <Picker
                  title="选择字重"
                  value={selectedIndex}
                  disabled={installing}
                  onChanged={(index: number) => {
                    setPreviewState("loading")
                    setCopyMessage(null)
                    setSelectedIndex(index)
                  }}
                  pickerStyle="menu"
                >
                  {fonts.map((font, index) => <Text tag={index}>{font.styleName}</Text>)}
                </Picker>
              ) : null}
            </HStack>
            <DetailRow label="字体家族" value={selectedFont.familyName} disabled={installing} onCopy={() => void copyFontValue(selectedFont.familyName, "字体家族名称")} />
            <DetailRow label="PostScript" value={selectedFont.postScriptName} disabled={installing} onCopy={() => void copyFontValue(selectedFont.postScriptName, "PostScript 名称")} />
            {copyMessage ? <Text font={uiFont(12)} foregroundStyle="systemGreen">{copyMessage}</Text> : null}
          </VStack>

          <ZStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} clipShape={{ type: "rect", cornerRadius: 16, style: "continuous" }}>
            <WebView controller={controller} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} />
            {previewState === "loading" ? (
              <VStack spacing={10}>
                <ProgressView progressViewStyle="circular" />
                <Text font={uiFont(13)} foregroundStyle="secondaryLabel">正在生成字体预览…</Text>
              </VStack>
            ) : null}
            {typeof previewState === "object" ? (
              <VStack spacing={8} padding={20}>
                <Image systemName="exclamationmark.triangle" font={24} foregroundStyle="systemOrange" />
                <Text font={uiFont(17)} fontWeight="semibold" foregroundStyle="label">无法显示预览</Text>
                <Text font={uiFont(13)} foregroundStyle="secondaryLabel" multilineTextAlignment="center">{previewState.message}</Text>
              </VStack>
            ) : null}
          </ZStack>

          <CapsuleButton title={installing ? "正在准备安装…" : "安装到系统"} icon="checkmark.shield" prominent disabled={!previewReady || installing} action={() => void installFont()} />
        </VStack>
      </ZStack>
    </NavigationStack>
  )
}
