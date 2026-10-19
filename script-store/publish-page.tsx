import { Button, Divider, HStack, Image, List, Navigation, NavigationStack, Picker, ProgressView, Section, Text, TextField, VStack, useState } from "scripting"
import { readAuthor, saveAuthor } from "./favorites"
import { ACCENT, CARD_ROW, FootNote, GLASS, ScriptIcon, SectionTitle, errorMessage } from "./glass-ui"
import { validateScriptURL } from "./install"
import { SITE_URL, hostOf, submitScript } from "./store-api"
import { useUIFont } from "./ui-font"

type IconMode = "symbol" | "icon"

const LIMITS = { name: 50, description: 200, author: 50, url: 2048, icon: 2048 }

/** 去掉控制字符并截断，与原站表单限制一致。 */
function clean(value: string, max: number): string {
  return value.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").slice(0, max)
}

function Field({ icon, title, prompt, value, onChanged, max, multiline = false, plain = false }: {
  icon: string
  title: string
  prompt: string
  value: string
  onChanged: (value: string) => void
  max: number
  multiline?: boolean
  /** 链接、符号名：关闭自动大写与纠错。 */
  plain?: boolean
}) {
  const font = useUIFont()
  return (
    <HStack spacing={10} alignment={multiline ? "top" : "center"} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Image systemName={icon} font={15} foregroundStyle={ACCENT} frame={{ width: 20 }} padding={{ top: multiline ? 2 : 0 }} />
      <TextField
        title={title}
        prompt={prompt}
        value={value}
        onChanged={text => onChanged(clean(text, max))}
        axis={multiline ? "vertical" : undefined}
        lineLimit={multiline ? { min: 2, max: 6 } : undefined}
        textFieldStyle="plain"
        font={font(16)}
        textInputAutocapitalization={plain ? "never" : undefined}
        autocorrectionDisabled={plain}
        frame={{ maxWidth: "infinity" }}
      />
    </HStack>
  )
}

/** 发布脚本到商店。成功时 `dismiss(true)`。 */
function PublishPage() {
  const dismiss = Navigation.useDismiss()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [author, setAuthor] = useState(readAuthor)
  const [url, setUrl] = useState("")
  const [mode, setMode] = useState<IconMode>("symbol")
  const [symbol, setSymbol] = useState("")
  const [icon, setIcon] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    const data = {
      name: name.trim(),
      description: description.trim(),
      author: author.trim() || "脚本作者",
      url: url.trim(),
      symbol: mode === "symbol" ? symbol.trim() || "star.fill" : "",
      icon: mode === "icon" ? icon.trim() : "",
    }
    const missing = !data.name ? "名称" : !data.description ? "描述" : !data.url ? "脚本链接" : ""
    if (missing) {
      await Dialog.alert({ title: "信息不完整", message: `请填写${missing}。` })
      return
    }
    const urlError = validateScriptURL(data.url)
    if (urlError) {
      await Dialog.alert({ title: "链接无效", message: urlError })
      return
    }
    const confirmed = await Dialog.confirm({
      title: "公开发布",
      message: `「${data.name}」将提交到 ${hostOf(SITE_URL)}，所有人可见并可安装。`,
      confirmLabel: "发布",
    })
    if (!confirmed) return

    setBusy(true)
    try {
      await submitScript(data)
      saveAuthor(author.trim())
      HapticFeedback.notificationSuccess()
      dismiss(true)
    } catch (error) {
      await Dialog.alert({ title: "发布失败", message: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <NavigationStack>
      <List
        listStyle="inset"
        scrollContentBackground="hidden"
        background="systemGroupedBackground"
        scrollDismissesKeyboard="interactively"
        navigationTitle="发布脚本"
        navigationBarTitleDisplayMode="inline"
        interactiveDismissDisabled={busy}
        toolbar={{
          cancellationAction: <Button title="取消" systemImage="xmark" disabled={busy} action={() => dismiss()} />,
          confirmationAction: busy ? <ProgressView progressViewStyle="circular" /> : <Button title="发布" systemImage="paperplane" action={() => void submit()} />,
        }}
      >
        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle icon="square.and.pencil" title="基本信息" />
          <VStack spacing={12} padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
            <Field icon="textformat.abc" title="名称" prompt="脚本名称（必填）" value={name} onChanged={setName} max={LIMITS.name} />
            <Divider />
            <Field icon="text.alignleft" title="描述" prompt="功能简介（必填）" value={description} onChanged={setDescription} max={LIMITS.description} multiline />
            <Divider />
            <Field icon="person" title="作者" prompt="脚本作者" value={author} onChanged={setAuthor} max={LIMITS.author} />
            <Divider />
            <Field icon="link" title="链接" prompt="脚本链接（必填）" value={url} onChanged={setUrl} max={LIMITS.url} plain />
          </VStack>
        </Section>

        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle icon="app.badge" title="图标" />
          <VStack spacing={12} padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
            <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <ScriptIcon item={{ symbol: mode === "symbol" ? symbol.trim() || "star.fill" : "", icon: mode === "icon" ? icon.trim() : "" }} size={52} />
              <Picker title="图标类型" value={mode} onChanged={(value: string) => setMode(value as IconMode)} pickerStyle="segmented" frame={{ maxWidth: "infinity" }}>
                <Text tag="symbol">SF Symbol</Text>
                <Text tag="icon">图片 / Emoji</Text>
              </Picker>
            </HStack>
            <Divider />
            {mode === "symbol"
              ? <Field icon="star.square" title="符号" prompt="如 star.fill" value={symbol} onChanged={setSymbol} max={64} plain />
              : <Field icon="photo" title="图标" prompt="图片 URL 或一个 emoji" value={icon} onChanged={setIcon} max={LIMITS.icon} plain />}
          </VStack>
          <FootNote>脚本链接支持 .scripting / .zip / .js 文件、GitHub 目录或 scripting://import_scripts 链接，安装时由 Scripting 导入。发布后公开可见，作者名会保存在本机供下次填写。</FootNote>
        </Section>
      </List>
    </NavigationStack>
  )
}

/** 发布成功返回 true。 */
export async function presentPublish(): Promise<boolean> {
  return (await Navigation.present<boolean>({ element: <PublishPage /> })) === true
}
