import { Button, List, Navigation, NavigationStack, Script, Toolbar, ToolbarItem, useState } from "scripting"
import { loadFontHistory } from "./font-history"
import { errorMessage, readUIFont, saveUIFont } from "./glass-ui"
import { HistorySection } from "./history-section"
import { InstallSection } from "./install-section"

/** 单页：上方导入与安装，下方安装历史。 */
function FontsInstaller() {
  const dismiss = Navigation.useDismiss()
  const [history, setHistory] = useState(loadFontHistory)
  const [appliedFont, setAppliedFont] = useState(readUIFont)

  function applyFont(name: string | null) {
    saveUIFont(name)
    setAppliedFont(name)
  }

  return (
    <NavigationStack>
      <List
        listStyle="inset"
        scrollContentBackground="hidden"
        background="systemGroupedBackground"
        navigationTitle="Fonts Installer"
        navigationBarTitleDisplayMode="inline"
        toolbar={<Toolbar><ToolbarItem placement="cancellationAction"><Button title="关闭" action={() => dismiss()} /></ToolbarItem></Toolbar>}
      >
        <InstallSection onHistoryChange={setHistory} appliedFont={appliedFont} />
        <HistorySection entries={history} onChange={setHistory} appliedFont={appliedFont} onApplyFont={applyFont} />
      </List>
    </NavigationStack>
  )
}

async function run() {
  try {
    await Navigation.present({ element: <FontsInstaller /> })
  } catch (error) {
    await Dialog.alert({ title: "无法打开字体", message: errorMessage(error) })
  } finally {
    DocumentPicker.stopAcessingSecurityScopedResources()
    Script.exit()
  }
}

void run()
