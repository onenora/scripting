# XBS Converter 设计

## 原则

- **纯本地转换**：XXTEA 由 TypeScript 实现，不依赖 Python 或网络。
- **字节一致**：与 xiangse-sources `scripts/xbs.js` 输出逐字节相同；导出 XBS 时解密回读比对，不一致不生成文件。
- **可修复**：非法 JSON 也能导入，进入编辑器修复后再导出。

## XBS 格式

```
XBS = XXTEA_encrypt( JSON 字节 ‖ 补零到 4 字节对齐 ‖ 原长度 uint32 LE , key )
key = e5 87 bc e8 a4 86 e6 bb bf e9 87 91 e6 ba a1 e5
```

- 解密后读取末 4 字节长度 `m`，要求 `n-3 ≤ m ≤ n`（`n` 为去掉长度后的字节数），否则判定不是 XBS。
- 编码前用 `JSON.stringify(JSON.parse(text))` 压缩，与香色导出一致；库内保存 2 空格缩进的 JSON。
- 导出密码：设置后编码前为每个书源写入 `"password": "<密码>"`（覆盖已有值），只作用于导出的 XBS；未设置时保留书源原有字段。这是香色的弱保护，不改变加密算法。
- 识别：`.xbs` 解密；`.json` 按文本；其他扩展名先尝试 JSON，失败再解密。

## 运行结构

```
index.tsx
└─ Navigation.present(LibraryPage)       # 单页 List：书源库
   ├─ EntryCard                          # 每个文件一张卡片，左滑重命名 / 删除
   │  └─ SourceDetailPage（push）        # 概览、书源列表、检查结果；navigationDestination 挂在 List 上
   ├─ presentJsonEditor（全屏）           # App 内置 Editor，保存时校验 JSON
   └─ presentSettings（右上角）           # 导出密码
intent.tsx
└─ 导入分享的文件 → LibraryPage
```

`LibraryPage` 持有书源库列表，所有写入经 `library.ts` 落盘后回写状态；详情页保存时原位更新，打开中的详情页不会因排序变化被关闭。

## 模块

| 模块 | 职责 |
|---|---|
| `xbs.ts` | XXTEA 加解密与长度标记，纯函数 |
| `source.ts` | UTF-8 编解码、文件识别、XBS 编解码与往返校验、书源检查、单个书源启用 / 删除 |
| `library.ts` | 书源库存储：索引 + 每个文件一份 JSON |
| `actions.ts` | 导出到「文件」、复制、重命名 |
| `template.ts` | 新建书源骨架 |
| `settings.ts` / `settings-page.tsx` | 导出密码读写（钥匙串）与设置页 |
| `glass-ui.tsx` | 通用组件：`SectionTitle`、`StatusSurface`、`CapsuleButton`、`CapsuleMenu`、`Tag`、`FootNote` 等 |
| `library-page.tsx` / `source-detail-page.tsx` / `json-editor-page.tsx` | 主页、详情、编辑器 |
| `issues-page.tsx` | 检查结果分级展示与弹出页 |

## 检查

规则取自 xiangse-sources 的硬约束，只给提示，不阻止导出。提示分三级：会闪退（红）、可能无法使用（橙）、建议（蓝），卡片标签取最严重一级的颜色，点按标签打开检查结果，可直接跳到编辑 JSON。

- 顶层为「别名 → 书源」对象；`sourceName` / `sourceUrl` 存在，`sourceType` 为 `"text"`，建议带 `miniAppVersion`。
- `weight` 必须是字符串（数字闪退）。
- 四个核心 action 齐全，`actionID` 与键名一致，`parserID` 为 DOM / JS，`requestInfo` 为字符串，`responseFormatType` 为 `""`/`base64str`/`html`/`xml`/`json`/`data`（禁 `text`）。
- `bookWorld` 为字典，禁 `categories` 数组；`moreKeys.requestFilters` 为字符串。
- 禁 Legado 字段：`bookSourceName`、`bookSourceUrl`，action 内 `method`/`data`/`body`/`headers`，以及 `java.getParams`。

### 自动修复

`fixSources` 只做确定的类型 / 取值转换，与 `Issue.fixable` 使用同一组判定函数，修复后重新检查：

| 问题 | 修复 |
|---|---|
| `requestInfo` 缺失（详情 / 目录 / 正文） | `"%@result"` |
| `requestInfo` 为对象 | `"@js:\nreturn {…};"`，返回同一请求对象 |
| `requestInfo` 为数字等 | `String(value)` |
| `weight` 为数字 | 转字符串 |
| `sourceType` 缺失 / 空 / 大小写不符 | `"text"` |
| `responseFormatType` 缺失或为 `text` | `""` |
| `parserID` 大小写、`actionID` 与键名不符 | 校正 |
| 缺 `miniAppVersion` | `"2.56.1"` |
| 顶层是单个书源 | 以 `sourceName` 为别名包一层 |

搜索缺少请求地址、非文本 `sourceType`（如 `comic`）、Legado 字段、`bookWorld` 结构等需要手动修改。

## 数据

| 数据 | 位置 |
|---|---|
| 书源库索引 `library.json`、书源 `<id>.json` | `FileManager.appGroupDocumentsDirectory/xbs-converter/` |
| 导出密码 `xbs-converter.export-password` | 钥匙串（不同步 iCloud） |

## 页面

- 空状态卡片自带导入按钮；有内容后右上角 + 菜单提供导入、粘贴、新建。
- 状态标签：绿色「检查通过」、橙色「N 项提示」、红色「JSON 无效」（无效时禁用导出）。

## 发布

`script.json` 的 `remoteResource` 指向仓库子目录，只写 `url` 与 `autoUpdateInterval`，`hash` 由 App 生成，不提交。
