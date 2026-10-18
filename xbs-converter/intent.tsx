import { Intent, Navigation, Path, Script } from "scripting"
import { errorMessage } from "./glass-ui"
import { addEntries, loadLibrary } from "./library"
import { LibraryPage } from "./library-page"
import { readSourceFile } from "./source"

/** 分享表单 / 快捷指令传入 .xbs / .json：导入书源库后打开主页。 */
async function run() {
  const paths = Intent.fileURLsParameter ?? []
  const parameter = Intent.shortcutParameter
  if (!paths.length && parameter?.type === "fileURL" && typeof parameter.value === "string") paths.push(parameter.value)

  const items = []
  const failures: string[] = []
  for (const path of paths) {
    try {
      items.push(await readSourceFile(path))
    } catch (error) {
      failures.push(`${Path.basename(path)}：${errorMessage(error)}`)
    }
  }
  DocumentPicker.stopAcessingSecurityScopedResources()

  let failureMessage: string | null = null
  try {
    if (!paths.length) throw new Error("请分享 .xbs 或 .json 书源文件。")
    if (failures.length) await Dialog.alert({ title: items.length ? "部分文件未导入" : "无法导入", message: failures.join("\n") })
    const entries = items.length ? addEntries(loadLibrary(), items) : loadLibrary()
    await Navigation.present({ element: <LibraryPage initialEntries={entries} notice={items.length ? `已导入 ${items.length} 个文件` : undefined} /> })
  } catch (error) {
    failureMessage = errorMessage(error)
    await Dialog.alert({ title: "无法打开书源", message: failureMessage })
  }
  Script.exit(failureMessage ? Intent.text(failureMessage) : undefined)
}

void run()
