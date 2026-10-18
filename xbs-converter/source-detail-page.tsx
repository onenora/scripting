import { Button, Circle, HStack, Image, List, Menu, Navigation, Section, Spacer, Text, VStack, useMemo, useState } from "scripting"
import { copyJSON, exportEntry, renameEntry } from "./actions"
import { ACCENT, CARD_ROW, CapsuleButton, CapsuleMenu, FootNote, GLASS, SectionTitle, StatusSurface, Tag, errorMessage, formatTime } from "./glass-ui"
import { CHECK_NOTE, FIX_NOTE, FixBanner, IssueGroups, presentIssues, worstLevelColor } from "./issues-page"
import { presentJsonEditor } from "./json-editor-page"
import type { LibraryEntry } from "./library"
import { fixSources, formatSize, inspectSources, removeSource, setSourceEnabled, sourceJSON, utf8Bytes, type Issue, type SourceInfo } from "./source"

const ORIGIN_LABEL = { xbs: "XBS 导入", json: "JSON 导入", text: "粘贴 / 新建" } as const

/** 书源文件详情：概览、逐个书源管理、约束检查，编辑整份 JSON。 */
export function SourceDetailPage({ initial, password, onSave, onDelete }: {
  initial: LibraryEntry
  password: string
  onSave: (entry: LibraryEntry) => void
  onDelete: (id: string) => void
}) {
  const dismiss = Navigation.useDismiss()
  const [entry, setEntry] = useState(initial)
  const inspection = useMemo(() => inspectSources(entry.text), [entry.text])
  const size = useMemo(() => utf8Bytes(entry.text).length, [entry.text])

  function update(next: Partial<LibraryEntry>) {
    const updated = { ...entry, ...next, updatedAt: Date.now() }
    setEntry(updated)
    onSave(updated)
  }

  async function edit() {
    const text = await presentJsonEditor(entry.name, entry.text)
    if (text !== undefined && text !== entry.text) update({ text })
  }

  function fix() {
    try {
      const result = fixSources(entry.text)
      if (!result.fixed) return
      update({ text: result.text })
      HapticFeedback.notificationSuccess()
    } catch (error) {
      void Dialog.alert({ title: "无法修复", message: errorMessage(error) })
    }
  }

  async function rename() {
    const name = await renameEntry(entry)
    if (name) update({ name })
  }

  async function remove() {
    const confirmed = await Dialog.confirm({ title: `删除「${entry.name}」？`, message: "只从书源库移除，已导出的文件不受影响。", confirmLabel: "删除", cancelLabel: "取消" })
    if (!confirmed) return
    dismiss()
    onDelete(entry.id)
  }

  async function changeSource(source: SourceInfo, change: "toggle" | "remove") {
    try {
      if (change === "remove") {
        const confirmed = await Dialog.confirm({ title: `删除书源「${source.name}」？`, message: "将从这份 JSON 中移除该书源。", confirmLabel: "删除", cancelLabel: "取消" })
        if (!confirmed) return
      }
      update({ text: change === "remove" ? removeSource(entry.text, source.alias) : setSourceEnabled(entry.text, source.alias, !source.enabled) })
    } catch (error) {
      await Dialog.alert({ title: "无法修改书源", message: errorMessage(error) })
    }
  }

  async function previewSource(source: SourceInfo) {
    try {
      await presentJsonEditor(source.name, sourceJSON(entry.text, source.alias), true)
    } catch (error) {
      await Dialog.alert({ title: "无法预览", message: errorMessage(error) })
    }
  }

  const invalid = inspection.error !== null
  const enabledCount = inspection.sources.filter(source => source.enabled).length

  return (
    <List
      listStyle="inset"
      scrollContentBackground="hidden"
      background="systemGroupedBackground"
      navigationTitle={entry.name}
      navigationBarTitleDisplayMode="inline"
      toolbar={{
        primaryAction: (
          <Menu label={<Image systemName="ellipsis.circle" accessibilityLabel="更多操作" />}>
            <Button title="重命名" systemImage="pencil" action={() => void rename()} />
            <Button title="复制 JSON" systemImage="doc.on.doc" action={() => void copyJSON(entry.text)} />
            <Button title="删除" systemImage="trash" role="destructive" action={() => void remove()} />
          </Menu>
        ),
      }}
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={14} padding={{ horizontal: 16, vertical: 16 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
          <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <EntryIcon invalid={invalid} size={44} />
            <VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Text font={17} fontWeight="semibold" foregroundStyle="label" lineLimit={2}>{entry.name}</Text>
              <Text font={12} foregroundStyle="secondaryLabel" lineLimit={1}>{`${ORIGIN_LABEL[entry.origin]} · ${formatSize(size)} · ${formatTime(entry.updatedAt)}`}</Text>
            </VStack>
          </HStack>
          <HStack spacing={6} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <InspectionTag issues={inspection.issues} invalid={invalid} name={entry.name} onEdit={() => void edit()} onFix={fix} />
            {invalid ? null : <Tag text={`${enabledCount}/${inspection.sources.length} 启用`} color="secondaryLabel" icon="power" />}
          </HStack>
          <HStack spacing={10} frame={{ maxWidth: "infinity" }}>
            <CapsuleButton title="编辑 JSON" icon="curlybraces" action={() => void edit()} />
            <Spacer />
            <ExportMenu entry={entry} password={password} disabled={invalid} />
          </HStack>
        </VStack>
      </Section>

      {invalid ? null : (
        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle icon="books.vertical" title="书源" detail={`${inspection.sources.length} 个`} />
          {inspection.sources.length === 0
            ? <StatusSurface icon="tray" title="没有书源" detail="在 JSON 中按「别名 → 书源」添加。" />
            : inspection.sources.map(source => (
              <SourceRow
                key={source.alias}
                source={source}
                onPreview={() => void previewSource(source)}
                onToggle={() => void changeSource(source, "toggle")}
                onRemove={() => void changeSource(source, "remove")}
              />
            ))}
        </Section>
      )}

      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <SectionTitle icon="checkmark.seal" title="检查" detail={invalid ? "JSON 无效" : inspection.issues.length ? `${inspection.issues.length} 项` : "通过"} />
        {invalid ? (
          <StatusSurface icon="exclamationmark.octagon" iconForegroundStyle="systemRed" title="JSON 无效" detail={inspection.error ?? ""}>
            <CapsuleButton title="编辑修复" icon="curlybraces" prominent action={() => void edit()} />
          </StatusSurface>
        ) : inspection.issues.length === 0 ? (
          <HStack spacing={10} padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content} {...CARD_ROW}>
            <Image systemName="checkmark.circle.fill" font={17} foregroundStyle="systemGreen" />
            <Text font={14} foregroundStyle="label">符合香色 2.56.1 文本书源硬约束</Text>
          </HStack>
        ) : (
          <>
            <FixBanner count={inspection.issues.filter(issue => issue.fixable).length} onFix={fix} />
            <IssueGroups issues={inspection.issues} />
          </>
        )}
        <FootNote>{`${CHECK_NOTE}左滑书源可启用 / 停用或删除，点按预览单个书源 JSON。\n\n${FIX_NOTE}`}</FootNote>
      </Section>
    </List>
  )
}

export function EntryIcon({ invalid, size }: { invalid: boolean; size: number }) {
  return (
    <Image
      systemName={invalid ? "exclamationmark.triangle.fill" : "book.closed.fill"}
      font={size * 0.42}
      fontWeight="semibold"
      foregroundStyle={invalid ? "systemRed" : ACCENT}
      frame={{ width: size, height: size }}
      background={<Circle fill={invalid ? "systemRed" : ACCENT} opacity={0.14} />}
    />
  )
}

/** 点按「N 项提示」查看检查结果，点按「JSON 无效」直接编辑。 */
export function InspectionTag({ issues, invalid, name, onEdit, onFix }: { issues: Issue[]; invalid: boolean; name: string; onEdit: () => void; onFix: () => void }) {
  if (!invalid && !issues.length) return <Tag text="检查通过" color="systemGreen" icon="checkmark.seal" />
  const show = async () => {
    if (invalid) return onEdit()
    const action = await presentIssues(name, issues)
    if (action === "edit") onEdit()
    if (action === "fix") onFix()
  }
  return (
    <Button action={() => void show()} accessibilityLabel={invalid ? "编辑无效 JSON" : "查看检查结果"} buttonStyle="borderless">
      {invalid
        ? <Tag text="JSON 无效" color="systemRed" icon="xmark.octagon" />
        : <Tag text={`${issues.length} 项提示`} color={worstLevelColor(issues)} icon="exclamationmark.triangle" />}
    </Button>
  )
}

export function ExportMenu({ entry, password, disabled }: { entry: LibraryEntry; password: string; disabled: boolean }) {
  return (
    <CapsuleMenu title="导出" icon="square.and.arrow.up" prominent disabled={disabled}>
      <Button title={password ? "导出 XBS（含密码）" : "导出 XBS"} systemImage={password ? "lock.doc.fill" : "lock.doc"} action={() => void exportEntry(entry, "xbs", password)} />
      <Button title="导出 JSON" systemImage="doc.text" action={() => void exportEntry(entry, "json")} />
      <Button title="复制 JSON" systemImage="doc.on.doc" action={() => void copyJSON(entry.text)} />
    </CapsuleMenu>
  )
}

function SourceRow({ source, onPreview, onToggle, onRemove }: {
  source: SourceInfo
  onPreview: () => void
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <Button
      action={onPreview}
      buttonStyle="plain"
      {...CARD_ROW}
      leadingSwipeActions={{ actions: [<Button title={source.enabled ? "停用" : "启用"} systemImage="power" tint={source.enabled ? "systemGray" : "systemGreen"} action={onToggle} />] }}
      trailingSwipeActions={{ actions: [<Button title="删除" systemImage="trash" role="destructive" action={onRemove} />] }}
    >
      <HStack spacing={12} padding={{ horizontal: 16, vertical: 12 }} frame={{ maxWidth: "infinity", alignment: "leading" }} contentShape={{ type: "rect", cornerRadius: 16, style: "continuous" }} glassEffect={GLASS.interactive}>
        <Circle fill={source.enabled ? "systemGreen" : "systemGray3"} frame={{ width: 8, height: 8 }} />
        <VStack spacing={3} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={15} fontWeight="semibold" foregroundStyle={source.enabled ? "label" : "secondaryLabel"} lineLimit={1}>{source.name}</Text>
          <Text font={11} monospaced foregroundStyle="secondaryLabel" lineLimit={1} truncationMode="middle">{source.url || source.alias}</Text>
        </VStack>
        {source.missingActions.length ? <Tag text={`缺 ${source.missingActions.length} 项`} color="systemOrange" /> : null}
        {source.enabled ? null : <Tag text="已停用" color="secondaryLabel" />}
        <Image systemName="chevron.right" font={12} fontWeight="semibold" foregroundStyle="tertiaryLabel" />
      </HStack>
    </Button>
  )
}
