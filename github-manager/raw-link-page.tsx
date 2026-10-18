import { githubBlobToRawURL, rawLinkConversionError } from "./raw-link"

export async function convertGitHubLinkFromClipboard(): Promise<void> {
  const clipboardText = await Pasteboard.getString()
  const input = await Dialog.prompt({
    title: "GitHub Raw 链接转换",
    message: "粘贴 GitHub 文件的具体链接，例如 /blob/main/path/to/file.json。确认后会生成并复制对应的 Raw 原始链接。",
    defaultValue: clipboardText ?? "",
    placeholder: "https://github.com/foo/bar/blob/main/path/to/file.json",
    confirmLabel: "转换",
  })
  if (input === null) return

  const converted = githubBlobToRawURL(input)
  if (!converted) {
    await Dialog.alert({ title: "无法转换", message: rawLinkConversionError(input) })
    return
  }

  await Pasteboard.setString(converted)
  const showLink = await Dialog.confirm({ title: "Raw 链接已复制", message: "链接已复制到剪贴板。", confirmLabel: "查看完整链接", cancelLabel: "完成" })
  if (showLink) await Dialog.alert({ title: "Raw 链接", message: converted })
}
