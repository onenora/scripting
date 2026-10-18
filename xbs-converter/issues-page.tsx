import { Button, HStack, Image, List, Navigation, NavigationStack, Section, Text, VStack, type Color } from "scripting"
import { ACCENT, CARD_ROW, CapsuleButton, FootNote, GLASS, SectionTitle, Tag } from "./glass-ui"
import type { Issue, IssueLevel } from "./source"

export const LEVELS: { level: IssueLevel; title: string; detail: string; icon: string; color: Color }[] = [
  { level: "crash", title: "会闪退", detail: "香色导入或打开书源时直接崩溃，必须修改。", icon: "xmark.octagon.fill", color: "systemRed" },
  { level: "error", title: "可能无法使用", detail: "导入失败，或搜索、目录、正文解析不到内容。", icon: "exclamationmark.triangle.fill", color: "systemOrange" },
  { level: "hint", title: "建议", detail: "通常不影响使用，按规范补齐更稳妥。", icon: "lightbulb.fill", color: "systemBlue" },
]

/** 最严重一级的颜色，用于卡片标签。 */
export function worstLevelColor(issues: Issue[]): Color {
  return LEVELS.find(meta => issues.some(issue => issue.level === meta.level))?.color ?? "systemGreen"
}

/** 按严重程度分组的提示卡片，每组一行。 */
export function IssueGroups({ issues }: { issues: Issue[] }) {
  return (
    <>
      {LEVELS.filter(meta => issues.some(issue => issue.level === meta.level)).map(meta => {
        const items = issues.filter(issue => issue.level === meta.level)
        return (
          <VStack key={meta.level} spacing={10} padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
            <HStack spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Image systemName={meta.icon} font={14} foregroundStyle={meta.color} />
              <Text font={15} fontWeight="semibold" foregroundStyle="label">{meta.title}</Text>
              <Text font={12} fontWeight="semibold" foregroundStyle={meta.color}>{String(items.length)}</Text>
            </HStack>
            <Text font={12} foregroundStyle="secondaryLabel" fixedSize={{ horizontal: false, vertical: true }}>{meta.detail}</Text>
            {items.map(issue => (
              <HStack spacing={8} alignment="firstTextBaseline" frame={{ maxWidth: "infinity", alignment: "leading" }}>
                <Text font={13} foregroundStyle={meta.color}>•</Text>
                <Text font={13} foregroundStyle="label" textSelection fixedSize={{ horizontal: false, vertical: true }} frame={{ maxWidth: "infinity", alignment: "leading" }}>{issue.text}</Text>
                {issue.fixable ? <Tag text="可修复" color="systemGreen" icon="wand.and.stars" /> : null}
              </HStack>
            ))}
          </VStack>
        )
      })}
    </>
  )
}

/** 可自动修复时显示在提示列表上方。 */
export function FixBanner({ count, onFix }: { count: number; onFix: () => void }) {
  if (!count) return null
  return (
    <HStack spacing={12} padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
      <Image systemName="wand.and.stars" font={20} fontWeight="semibold" foregroundStyle={ACCENT} frame={{ width: 28 }} />
      <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={15} fontWeight="semibold" foregroundStyle="label">{`${count} 项可自动修复`}</Text>
        <Text font={12} foregroundStyle="secondaryLabel" fixedSize={{ horizontal: false, vertical: true }}>只做类型与取值转换，如 requestInfo 转字符串。</Text>
      </VStack>
      <CapsuleButton title="修复" icon="checkmark" prominent action={onFix} />
    </HStack>
  )
}

export const FIX_NOTE = "自动修复：缺失的 requestInfo 在详情、目录、正文中补为 %@result，请求对象改写为 @js 返回同一对象，其他值转字符串；weight 数字转字符串；sourceType 缺失补 \"text\"；responseFormatType 缺失或为 text 改为 \"\"；parserID 大小写、actionID 按键名校正；补 miniAppVersion。搜索缺少请求地址、非文本书源等需要手动修改。"

export const CHECK_NOTE = "检查对照香色闺阁（StandarReader 2.56.1）文本书源的硬约束，在导出前找出会闪退、导入失败或解析不到内容的写法。提示不阻止导出；通过检查也不代表书源一定能搜到书。"

export type IssuesAction = "edit" | "fix"

function IssuesPage({ name, issues }: { name: string; issues: Issue[] }) {
  const dismiss = Navigation.useDismiss()
  return (
    <NavigationStack>
      <List
        listStyle="inset"
        scrollContentBackground="hidden"
        background="systemGroupedBackground"
        navigationTitle="检查结果"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="完成" action={() => dismiss()} />,
          confirmationAction: <Button title="编辑 JSON" action={() => dismiss("edit")} />,
        }}
      >
        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle icon="checkmark.seal" title={name} detail={`${issues.length} 项`} />
          <FixBanner count={issues.filter(issue => issue.fixable).length} onFix={() => dismiss("fix")} />
          <IssueGroups issues={issues} />
          <FootNote>{`${CHECK_NOTE}\n\n${FIX_NOTE}`}</FootNote>
        </Section>
      </List>
    </NavigationStack>
  )
}

/** 返回用户选择的后续操作；点「完成」返回 undefined。 */
export async function presentIssues(name: string, issues: Issue[]): Promise<IssuesAction | undefined> {
  return Navigation.present<IssuesAction | undefined>({ element: <IssuesPage name={name} issues={issues} /> })
}
