import { errorMessage } from "./glass-ui"
import type { LibraryEntry } from "./library"
import { encodeXBS, utf8Bytes } from "./source"

export type ExportFormat = "xbs" | "json"

/** 导出到「文件」：XBS 为压缩 JSON 加密并经往返校验（可写入密码），JSON 为格式化文本。返回是否已保存。 */
export async function exportEntry(entry: Pick<LibraryEntry, "name" | "text">, format: ExportFormat, password = ""): Promise<boolean> {
  try {
    const data = format === "xbs" ? encodeXBS(entry.text, password) : Data.fromUint8Array(utf8Bytes(entry.text))
    if (!data) throw new Error("无法生成文件数据。")
    const paths = await DocumentPicker.exportFiles({ files: [{ data, name: `${entry.name}.${format}` }] })
    if (paths.length) HapticFeedback.notificationSuccess()
    return paths.length > 0
  } catch (error) {
    await Dialog.alert({ title: format === "xbs" ? "无法导出 XBS" : "无法导出 JSON", message: errorMessage(error) })
    return false
  }
}

export async function copyJSON(text: string) {
  try {
    await Pasteboard.setString(text)
    HapticFeedback.notificationSuccess()
  } catch (error) {
    await Dialog.alert({ title: "无法复制", message: errorMessage(error) })
  }
}

export async function renameEntry(entry: LibraryEntry): Promise<string | null> {
  const name = await Dialog.prompt({ title: "重命名", message: "用作导出的文件名。", defaultValue: entry.name, selectAll: true, confirmLabel: "保存", cancelLabel: "取消" })
  const trimmed = name?.trim().replace(/[\/:]/g, "-")
  return trimmed && trimmed !== entry.name ? trimmed : null
}
