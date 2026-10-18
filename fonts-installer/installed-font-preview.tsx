import { Button, Navigation, NavigationStack, ScrollView, Text, VStack, ZStack } from "scripting"
import { GLASS, PageBackground } from "./glass-ui"

function SampleText({ fontName, size, children }: { fontName: string; size: number; children: string }) {
  return <Text font={{ name: fontName, size }} foregroundStyle="label" frame={{ maxWidth: "infinity", alignment: "leading" }}>{children}</Text>
}

/** 用字体名渲染系统已安装字体的样张；未确认支持中文时只显示拉丁字符。 */
function InstalledFontPreviewView({ postScriptName, supportsChinese }: { postScriptName: string; supportsChinese: boolean }) {
  const dismiss = Navigation.useDismiss()
  return (
    <NavigationStack>
      <ZStack
        navigationTitle="字体预览"
        navigationBarTitleDisplayMode="inline"
        toolbar={{ cancellationAction: <Button title="关闭" action={() => dismiss()} /> }}
      >
        <PageBackground />
        <ScrollView>
          <VStack spacing={12} padding={{ top: 12, bottom: 32, horizontal: 16 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <VStack spacing={4} alignment="leading" padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
              <Text font={18} fontWeight="semibold" foregroundStyle="label">{postScriptName}</Text>
              <Text font={12} foregroundStyle="secondaryLabel">系统已安装字体 · PostScript 名称</Text>
            </VStack>
            <VStack spacing={20} padding={20} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
              <SampleText fontName={postScriptName} size={48}>{supportsChinese ? "字体预览 Aa" : "Font Preview Aa"}</SampleText>
              {supportsChinese ? <SampleText fontName={postScriptName} size={28}>{"天地玄黄，宇宙洪荒。\n春风又绿江南岸。"}</SampleText> : null}
              <SampleText fontName={postScriptName} size={24}>The quick brown fox jumps over the lazy dog.</SampleText>
              <SampleText fontName={postScriptName} size={18}>{"ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789\n.,:;!? @ # ¥ $ % & ( ) [ ] { }"}</SampleText>
            </VStack>
          </VStack>
        </ScrollView>
      </ZStack>
    </NavigationStack>
  )
}

export async function presentInstalledFontPreview(postScriptName: string, supportsChinese = false): Promise<void> {
  await Navigation.present({ element: <InstalledFontPreviewView postScriptName={postScriptName} supportsChinese={supportsChinese} /> })
}
