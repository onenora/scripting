import { useEffect, useState } from "scripting"

// 界面字体：保存 PostScript 名称，未设置时使用系统字体。导航栏标题、菜单与滑动按钮由系统绘制，不受影响；字体预览页不使用。
const UI_FONT_KEY = "fonts-installer.ui-font"

export type UIFont = (size: number) => number | { name: string; size: number }

let fontName: string | null = Storage.get<string>(UI_FONT_KEY) ?? null
const listeners = new Set<() => void>()

export function setFontName(name: string | null) {
  fontName = name
  if (name) Storage.set(UI_FONT_KEY, name)
  else Storage.remove(UI_FONT_KEY)
  for (const listener of listeners) listener()
}

/** 当前界面字体的 PostScript 名称；切换后所有使用此 Hook 的组件同步重绘。 */
export function useFontName(): string | null {
  const [name, setName] = useState(fontName)
  useEffect(() => {
    const listener = () => setName(fontName)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return name
}

/** 返回按当前界面字体取字号的函数。 */
export function useUIFont(): UIFont {
  const name = useFontName()
  return size => (name ? { name, size } : size)
}
