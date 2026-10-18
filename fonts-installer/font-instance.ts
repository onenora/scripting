import { Path, Script } from "scripting"
import { inspectFontData, type InspectedFont } from "./font"

async function hasFontTools(): Promise<boolean> {
  const result = await Python.run("import fontTools.varLib.instancer")
  return result.exitCode === 0
}

// 可变字体实例化依赖 fonttools，不随脚本内置；缺失时先用 pip 安装，失败再引导到 App 中手动安装。
async function ensureFontTools() {
  if (await hasFontTools()) return
  const confirmed = await Dialog.confirm({
    title: "需要安装 fonttools",
    message: "安装可变字体的单独字重需要 Python 库 fonttools，是否现在通过 pip 安装？",
    confirmLabel: "安装",
    cancelLabel: "取消",
  })
  if (!confirmed) throw new Error("未安装 fonttools，无法生成可变字体的独立字重。")

  const result = await Shell.run("pip install fonttools", { timeout: 300 })
  if (await hasFontTools()) return
  console.warn("pip install fonttools 失败", result.output)
  await Dialog.alert({
    title: "fonttools 安装失败",
    message: "请在 Scripting App 的 Python 包管理中安装 fonttools 后重试。",
  })
  throw new Error("未安装 fonttools，无法生成可变字体的独立字重。")
}

export async function prepareFontForInstall(selected: InspectedFont): Promise<InspectedFont> {
  if (!selected.info.variation) return selected

  if (typeof Python === "undefined" || typeof Python.run !== "function") {
    throw new Error("安装可变字体的单独字重需要支持 Python.run 的新版 Scripting。")
  }
  await ensureFontTools()

  const directory = Path.join(FileManager.temporaryDirectory, `fonts-installer-${UUID.string()}`)
  const extension = selected.info.format === "OpenType" ? ".otf" : ".ttf"
  const source = Path.join(directory, `source${extension}`)
  const destination = Path.join(directory, `instance${extension}`)
  try {
    await FileManager.createDirectory(directory, true)
    await FileManager.writeAsData(source, selected.data)
    const result = await Python.run(
      'import os, runpy; runpy.run_path(os.path.join(os.environ["FONT_INSTALLER_SCRIPT_DIR"], "font-instance.py"))',
      { env: {
        FONT_INSTALLER_SCRIPT_DIR: Script.directory,
        FONT_INSTALLER_INPUT: source,
        FONT_INSTALLER_OUTPUT: destination,
        FONT_INSTALLER_AXES: JSON.stringify(selected.info.variation.axes),
        FONT_INSTALLER_FAMILY: selected.info.familyName,
        FONT_INSTALLER_STYLE: selected.info.styleName,
        FONT_INSTALLER_FULL_NAME: selected.info.fullName,
        FONT_INSTALLER_POSTSCRIPT: selected.info.postScriptName,
      } },
    )
    if (result.exitCode !== 0 || !FileManager.existsSync(destination)) {
      throw new Error(`生成独立字重失败：${result.output.trim() || "字体无法实例化"}`)
    }
    const data = await FileManager.readAsData(destination)
    const info = inspectFontData(destination, data)
    return {
      data,
      info: {
        ...info,
        path: selected.info.path,
        fileName: selected.info.fileName,
        familyName: selected.info.familyName,
        styleName: selected.info.styleName,
        fullName: selected.info.fullName,
      },
    }
  } finally {
    try {
      await FileManager.remove(directory)
    } catch (error) {
      console.warn("无法清理字体实例临时文件", error)
    }
  }
}
