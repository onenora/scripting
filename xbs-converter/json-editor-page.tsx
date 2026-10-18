import { Button, Editor, Menu, Navigation, NavigationStack, Toolbar, ToolbarItem, VStack, useEffect, useMemo, useRef } from "scripting"
import { errorMessage } from "./glass-ui"

/**
 * 全屏 JSON 编辑器（App 内置 Editor，带语法高亮与查找替换）。
 * 保存时校验 JSON，`dismiss(text)` 返回新内容；取消返回 undefined。readOnly 时只预览。
 */
function JsonEditorPage({ title, text, readOnly }: { title: string; text: string; readOnly: boolean }) {
  const dismiss = Navigation.useDismiss()
  const controller = useMemo(() => new EditorController({ content: text, ext: "json", readOnly }), [])
  // content 镜像约每秒刷新一次，onContentChanged 约 100ms，取两者中较新的编辑结果。
  const latest = useRef(text)

  useEffect(() => {
    controller.onContentChanged = content => {
      latest.current = content
    }
    return () => controller.dispose()
  }, [controller])

  function current(): string {
    return latest.current !== text ? latest.current : controller.content
  }

  function reformat(indent: number | undefined) {
    try {
      const formatted = JSON.stringify(JSON.parse(current()), null, indent)
      controller.content = formatted
      latest.current = formatted
    } catch (error) {
      void Dialog.alert({ title: "JSON 无效", message: errorMessage(error) })
    }
  }

  async function save() {
    const content = current()
    try {
      JSON.parse(content)
    } catch (error) {
      const keep = await Dialog.confirm({ title: "JSON 无效", message: `${errorMessage(error)}\n\n仍要保存吗？导出前需要修复。`, confirmLabel: "仍然保存", cancelLabel: "继续编辑" })
      if (!keep) return
    }
    dismiss(content)
  }

  async function cancel() {
    if (current() !== text) {
      const discard = await Dialog.confirm({ title: "放弃修改？", message: "未保存的编辑将丢失。", confirmLabel: "放弃", cancelLabel: "继续编辑" })
      if (!discard) return
    }
    dismiss()
  }

  return (
    <NavigationStack>
      <VStack
        navigationTitle={title}
        navigationBarTitleDisplayMode="inline"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="cancellationAction">
              <Button title={readOnly ? "完成" : "取消"} action={() => void (readOnly ? dismiss() : cancel())} />
            </ToolbarItem>
            {readOnly ? null : (
              <ToolbarItem placement="topBarTrailing">
                <Menu title="格式" systemImage="wand.and.stars">
                  <Button title="格式化（2 空格）" systemImage="text.alignleft" action={() => reformat(2)} />
                  <Button title="压缩为一行" systemImage="arrow.right.to.line" action={() => reformat(undefined)} />
                </Menu>
              </ToolbarItem>
            )}
            {readOnly ? null : (
              <ToolbarItem placement="confirmationAction">
                <Button title="保存" action={() => void save()} />
              </ToolbarItem>
            )}
          </Toolbar>
        }
      >
        <Editor controller={controller} showAccessoryView={!readOnly} searchEnabled />
      </VStack>
    </NavigationStack>
  )
}

/** 返回保存后的文本；取消或只读时返回 undefined。 */
export async function presentJsonEditor(title: string, text: string, readOnly = false): Promise<string | undefined> {
  return Navigation.present<string | undefined>({ element: <JsonEditorPage title={title} text={text} readOnly={readOnly} />, modalPresentationStyle: "fullScreen" })
}
