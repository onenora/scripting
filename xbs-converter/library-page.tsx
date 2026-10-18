import { Button, HStack, List, Navigation, NavigationStack, Path, Section, Spacer, Text, VStack, useMemo, useRef, useState } from "scripting"
import { renameEntry } from "./actions"
import { CARD_ROW, CapsuleButton, FootNote, GLASS, HeaderIconMenu, SectionTitle, StatusSurface, errorMessage, formatTime } from "./glass-ui"
import { presentJsonEditor } from "./json-editor-page"
import { addEntries, removeEntry, saveEntry, type LibraryEntry } from "./library"
import { EntryIcon, ExportMenu, InspectionTag, SourceDetailPage } from "./source-detail-page"
import { fixSources, formatSize, inspectSources, prettyJSON, readSourceFile, utf8Bytes, type SourceOrigin } from "./source"
import { readExportPassword, saveExportPassword } from "./settings"
import { presentSettings } from "./settings-page"
import { SOURCE_TEMPLATE } from "./template"

type ImportItem = { name: string; origin: SourceOrigin; text: string }

/** 单页书源库：导入 XBS / JSON、粘贴、新建模板；卡片进入详情或直接导出。 */
export function LibraryPage({ initialEntries, notice }: { initialEntries: LibraryEntry[]; notice?: string }) {
  const dismiss = Navigation.useDismiss()
  const [entries, setEntries] = useState(initialEntries)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(notice ?? "")
  const [password, setPassword] = useState(readExportPassword)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailEntry = entries.find(entry => entry.id === detailId)
  // 详情页的回调可能来自较早的渲染，始终基于最新列表写入。
  const latest = useRef(entries)
  latest.current = entries

  function commit(next: LibraryEntry[]) {
    latest.current = next
    setEntries(next)
  }

  function add(items: ImportItem[], message: string) {
    commit(addEntries(latest.current, items))
    setStatus(message)
    HapticFeedback.notificationSuccess()
  }

  async function importFiles() {
    if (busy) return
    setBusy(true)
    try {
      const paths = await DocumentPicker.pickFiles({ types: ["public.data"], allowsMultipleSelection: true, shouldShowFileExtensions: true })
      if (!paths.length) return
      const items: ImportItem[] = []
      const failures: string[] = []
      for (const path of paths) {
        try {
          items.push(await readSourceFile(path))
        } catch (error) {
          failures.push(`${Path.basename(path)}：${errorMessage(error)}`)
        }
      }
      if (items.length) add(items, `已导入 ${items.length} 个文件`)
      if (failures.length) {
        await Dialog.alert({ title: items.length ? "部分文件未导入" : "无法导入", message: failures.join("\n") })
      }
    } catch (error) {
      await Dialog.alert({ title: "无法导入", message: errorMessage(error) })
    } finally {
      DocumentPicker.stopAcessingSecurityScopedResources()
      setBusy(false)
    }
  }

  async function pasteJSON() {
    const text = (await Pasteboard.getString())?.trim()
    if (!text) {
      await Dialog.alert({ title: "剪贴板为空", message: "请先复制书源 JSON。" })
      return
    }
    try {
      const inspection = inspectSources(text)
      if (inspection.error) throw new Error(inspection.error)
      add([{ name: inspection.sources[0]?.name ?? "粘贴的书源", origin: "text", text: prettyJSON(text) }], "已从剪贴板导入")
    } catch (error) {
      await Dialog.alert({ title: "剪贴板不是书源 JSON", message: errorMessage(error) })
    }
  }

  async function createFromTemplate() {
    const text = await presentJsonEditor("新建书源", SOURCE_TEMPLATE)
    if (text !== undefined) add([{ name: inspectSources(text).sources[0]?.name ?? "新建书源", origin: "text", text }], "已新建书源")
  }

  function save(entry: LibraryEntry) {
    try {
      commit(saveEntry(latest.current, entry))
    } catch (error) {
      void Dialog.alert({ title: "无法保存", message: errorMessage(error) })
    }
  }

  function remove(id: string) {
    const entry = latest.current.find(item => item.id === id)
    commit(removeEntry(latest.current, id))
    if (id === detailId) setDetailId(null)
    setStatus(entry ? `已删除：${entry.name}` : "")
  }

  function fix(entry: LibraryEntry) {
    try {
      const result = fixSources(entry.text)
      if (!result.fixed) return
      save({ ...entry, text: result.text })
      setStatus(`已修复 ${result.fixed} 项：${entry.name}`)
      HapticFeedback.notificationSuccess()
    } catch (error) {
      void Dialog.alert({ title: "无法修复", message: errorMessage(error) })
    }
  }

  async function rename(entry: LibraryEntry) {
    const name = await renameEntry(entry)
    if (name) save({ ...entry, name })
  }

  async function edit(entry: LibraryEntry) {
    const text = await presentJsonEditor(entry.name, entry.text)
    if (text !== undefined && text !== entry.text) save({ ...entry, text })
  }

  async function openSettings() {
    const next = await presentSettings(password)
    if (next === undefined || next === password) return
    try {
      saveExportPassword(next)
      setPassword(next)
      setStatus(next ? "导出 XBS 时将写入密码" : "已关闭导出密码")
    } catch (error) {
      await Dialog.alert({ title: "无法保存设置", message: errorMessage(error) })
    }
  }

  const importMenu = [
    <Button title="导入 XBS / JSON 文件" systemImage="doc.badge.plus" action={() => void importFiles()} />,
    <Button title="粘贴 JSON" systemImage="doc.on.clipboard" action={() => void pasteJSON()} />,
    <Button title="从模板新建" systemImage="square.and.pencil" action={() => void createFromTemplate()} />,
  ]

  return (
    <NavigationStack>
      <List
        listStyle="inset"
        scrollContentBackground="hidden"
        background="systemGroupedBackground"
        navigationTitle="XBS Converter"
        navigationBarTitleDisplayMode="inline"
        // 推入详情挂在 List 上：放在 List 行内的 navigationDestination 不会触发。
        navigationDestination={{
          isPresented: detailEntry !== undefined,
          onChanged: presented => {
            if (!presented) setDetailId(null)
          },
          content: detailEntry
            ? <SourceDetailPage key={detailEntry.id} initial={detailEntry} password={password} onSave={save} onDelete={remove} />
            : <></>,
        }}
        toolbar={{
          cancellationAction: <Button title="关闭" action={() => dismiss()} />,
          primaryAction: <Button title="设置" systemImage={password ? "gearshape.fill" : "gearshape"} action={() => void openSettings()} />,
        }}
      >
        <Section listRowBackground={<></>} listRowSeparator="hidden">
          <SectionTitle
            icon="books.vertical"
            title="书源库"
            detail={entries.length ? `${entries.length} 个文件` : undefined}
            // 空状态卡片自带导入按钮，有内容后才在右上角提供入口。
            action={entries.length ? <HeaderIconMenu icon="plus" label="添加书源" disabled={busy}>{importMenu}</HeaderIconMenu> : undefined}
          />
          {entries.length === 0 ? (
            <StatusSurface icon="arrow.left.arrow.right" title="导入书源" detail="支持 .xbs 与 .json，可多选，自动识别并互相转换。">
              <CapsuleButton title="选择文件" icon="doc.badge.plus" prominent disabled={busy} action={() => void importFiles()} />
              <CapsuleButton title="粘贴 JSON" icon="doc.on.clipboard" disabled={busy} action={() => void pasteJSON()} />
            </StatusSurface>
          ) : null}
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              password={password}
              onOpen={() => setDetailId(entry.id)}
              onDelete={remove}
              onEdit={() => void edit(entry)}
              onFix={() => fix(entry)}
              onRename={() => void rename(entry)}
            />
          ))}
          {status ? <Text font={12} foregroundStyle="secondaryLabel" lineLimit={2} frame={{ maxWidth: "infinity", alignment: "center" }} listRowBackground={<></>} listRowSeparator="hidden">{status}</Text> : null}
          <FootNote>XBS 是香色闺阁的加密书源格式。导出 XBS 时压缩 JSON 后加密，并解密回读逐字节校验。左滑卡片可重命名或删除；书源只保存在本脚本中。</FootNote>
        </Section>
      </List>
    </NavigationStack>
  )
}

function EntryCard({ entry, password, onOpen, onDelete, onEdit, onFix, onRename }: {
  entry: LibraryEntry
  password: string
  onOpen: () => void
  onDelete: (id: string) => void
  onEdit: () => void
  onFix: () => void
  onRename: () => void
}) {
  const inspection = useMemo(() => inspectSources(entry.text), [entry.text])
  const size = useMemo(() => utf8Bytes(entry.text).length, [entry.text])
  const invalid = inspection.error !== null
  const names = inspection.sources.map(source => source.name).join(" · ")

  return (
    <VStack
      spacing={12}
      padding={{ horizontal: 16, vertical: 14 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      glassEffect={GLASS.content}
      {...CARD_ROW}
      leadingSwipeActions={{ actions: [<Button title="重命名" systemImage="pencil" tint="systemBlue" action={onRename} />] }}
      trailingSwipeActions={{ actions: [<Button title="删除" systemImage="trash" role="destructive" action={() => onDelete(entry.id)} />] }}
    >
      <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <EntryIcon invalid={invalid} size={38} />
        <VStack spacing={2} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={16} fontWeight="semibold" foregroundStyle="label" lineLimit={1}>{entry.name}</Text>
          <Text font={12} foregroundStyle="secondaryLabel" lineLimit={1}>{`${invalid ? "无法解析" : `${inspection.sources.length} 个书源`} · ${formatSize(size)} · ${formatTime(entry.updatedAt)}`}</Text>
        </VStack>
        <InspectionTag issues={inspection.issues} invalid={invalid} name={entry.name} onEdit={onEdit} onFix={onFix} />
      </HStack>
      {names ? <Text font={12} foregroundStyle="secondaryLabel" lineLimit={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>{names}</Text> : null}
      <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
        <CapsuleButton title="详情" icon="list.bullet.rectangle" action={onOpen} />
        <CapsuleButton title="JSON" icon="curlybraces" action={onEdit} />
        <Spacer />
        <ExportMenu entry={entry} password={password} disabled={invalid} />
      </HStack>
    </VStack>
  )
}
