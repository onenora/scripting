import { Button, HStack, Image, List, Navigation, NavigationStack, SecureField, Section, Text, TextField, VStack, useState } from "scripting"
import { ACCENT, AboutCard, AboutLine, CARD_ROW, FootNote, GLASS, SectionTitle, Tag } from "./glass-ui"

/** 设置：导出 XBS 的书源密码。完成时 `dismiss(password)`，取消返回 undefined。 */
function SettingsPage({ initialPassword }: { initialPassword: string }) {
  const dismiss = Navigation.useDismiss()
  const [password, setPassword] = useState(initialPassword)
  const [visible, setVisible] = useState(false)
  const trimmed = password.trim()

  const field = visible
    ? <TextField title="密码" prompt="留空则不加密" value={password} onChanged={setPassword} textFieldStyle="plain" textInputAutocapitalization="never" autocorrectionDisabled frame={{ maxWidth: "infinity" }} />
    : <SecureField title="密码" prompt="留空则不加密" value={password} onChanged={setPassword} textFieldStyle="plain" frame={{ maxWidth: "infinity" }} />

  return (
    <NavigationStack>
      <List
        listStyle="inset"
        scrollContentBackground="hidden"
        background="systemGroupedBackground"
        navigationTitle="设置"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="取消" action={() => dismiss()} />,
          confirmationAction: <Button title="完成" action={() => dismiss(trimmed)} />,
        }}
      >
        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle icon="key" title="导出密码" action={trimmed ? <Tag text="已启用" color="systemGreen" icon="lock" /> : <Tag text="未设置" color="secondaryLabel" icon="lock.open" />} />
          <VStack spacing={12} padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
            <HStack spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Image systemName="lock.fill" font={15} foregroundStyle={ACCENT} frame={{ width: 20 }} />
              {field}
              {password ? (
                <Button action={() => setPassword("")} accessibilityLabel="清除密码" buttonStyle="borderless" frame={{ minWidth: 28, minHeight: 28 }}>
                  <Image systemName="xmark.circle.fill" font={15} foregroundStyle="tertiaryLabel" />
                </Button>
              ) : null}
              <Button action={() => setVisible(!visible)} accessibilityLabel={visible ? "隐藏密码" : "显示密码"} buttonStyle="borderless" frame={{ minWidth: 28, minHeight: 28 }}>
                <Image systemName={visible ? "eye.slash" : "eye"} font={15} foregroundStyle="secondaryLabel" />
              </Button>
            </HStack>
            {trimmed ? (
              <Text font={12} monospaced foregroundStyle="secondaryLabel" lineLimit={1} truncationMode="tail">{`"password": ${JSON.stringify(visible ? trimmed : "•".repeat(Math.min(trimmed.length, 12)))}`}</Text>
            ) : null}
          </VStack>
          <FootNote>设置后，导出 XBS 时为每个书源写入 password 字段（覆盖已有值），在香色闺阁中查看或编辑书源需输入该密码。书源库与 JSON 导出保持原样。这只是弱保护：XBS 可被解密读取。密码保存在钥匙串中。</FootNote>
        </Section>

        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle icon="info.circle" title="关于" />
          <AboutCard>
            <AboutLine icon="arrow.left.arrow.right" title="XBS ⇄ JSON" detail="香色闺阁书源 XBS 与 JSON 互转，书源库保存格式化后的 JSON，导出时再编码。" />
            <AboutLine icon="checklist" title="约束检查" detail="按香色闺阁的字段约束逐项检查，标「可修复」的问题可一键修复。" />
            <AboutLine icon="lock" title="本机保存" detail="书源库只存在本机，导出密码存钥匙串、不同步 iCloud。" />
          </AboutCard>
        </Section>
      </List>
    </NavigationStack>
  )
}

/** 返回新密码（可能为空字符串表示关闭）；取消返回 undefined。 */
export async function presentSettings(password: string): Promise<string | undefined> {
  return Navigation.present<string | undefined>({ element: <SettingsPage initialPassword={password} /> })
}
