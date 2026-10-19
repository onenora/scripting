import { Script } from "scripting"

const IMPORT_SCHEME = "scripting://import_scripts"

/** 把脚本链接包装成 Scripting 导入链接；已是导入链接时原样返回。 */
export function importURL(url: string): string {
  return url.startsWith(IMPORT_SCHEME) ? url : Script.createImportScriptsURLScheme([url])
}

/** 交给 Scripting 的导入流程，由 App 弹出确认。 */
export async function installScript(url: string): Promise<void> {
  if (!/^(https?|scripting):\/\//i.test(url)) throw new Error("不支持的脚本链接")
  if (!(await Safari.openURL(importURL(url)))) throw new Error("无法打开 Scripting 导入链接")
}

/** 发布前校验：http(s) 链接或 Scripting 导入链接。 */
export function validateScriptURL(url: string): string | null {
  if (url.startsWith(IMPORT_SCHEME)) return null
  if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(url)) return "请输入 http(s) 链接或 scripting://import_scripts 链接"
  return null
}
