import { Button, List, Navigation, NavigationStack, Script, Text, useState } from "scripting"
import { loadFontHistory } from "./font-history"
import { errorMessage } from "./glass-ui"
import { HistorySection } from "./history-section"
import { InstallSection } from "./install-section"
import { useUIFont } from "./ui-font"

const TITLE = "Fonts Installer"

/** 单页：上方导入与安装，下方安装历史。 */
function FontsInstaller() {
  const dismiss = Navigation.useDismiss()
  const font = useUIFont()
  const [history, setHistory] = useState(loadFontHistory)

  return (
    <NavigationStack>
      <List
        listStyle="inset"
        scrollContentBackground="hidden"
        background="systemGroupedBackground"
        navigationTitle={TITLE}
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="关闭" systemImage="xmark" action={() => dismiss()} />,
          principal: <Text font={font(17)} fontWeight="semibold" foregroundStyle="label">{TITLE}</Text>,
        }}
      >
        <InstallSection onHistoryChange={setHistory} />
        <HistorySection entries={history} onChange={setHistory} />
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
