# Script Store 设计

## 原则

- **安装交给 App**：脚本链接经 `Script.createImportScriptsURLScheme` 包装为 `scripting://import_scripts`，由 Scripting 弹出导入确认，本脚本不下载文件。
- **只读为主**：除用户主动发布外只发 GET 请求；收藏与作者名只存本机。
- **系统原生**：去掉原版的自绘导航栏、主题切换与渐变背景，改用 NavigationStack、`searchable`、`refreshable`、工具栏按钮与系统语义色。

## 运行结构

```
index.tsx
└─ Navigation.present(StorePage)          # 单页 List：站点声明、热门（横向）、收藏、全部脚本
   ├─ ScriptCard                          # 点按进详情，「获取」直接导入，右滑收藏
   │  └─ ScriptDetailPage（push）         # 安装、收藏、链接、描述、信息
   │     └─ AuthorPage（push）            # 作者作品，可继续进入详情
   └─ presentPublish（右上角 +）           # 发布表单，成功后重新加载
```

推入页面都挂在 List 的 `navigationDestination` 上，由选中 ID 驱动；放在行内的 `navigationDestination` 不会触发。

## 模块

| 模块 | 职责 |
|---|---|
| `store-api.ts` | 站点接口：脚本列表、站点公告、发布；字段清洗、作者解析、日期格式 |
| `install.ts` | 导入链接包装、打开 Scripting 导入、发布链接校验 |
| `favorites.ts` | 收藏 ID 存储与跨页同步 Hook、发布作者名 |
| `ui-font.ts` | 界面字体：PostScript 名称存储、`useUIFont` 订阅 Hook、FontPicker 选择 |
| `glass-ui.tsx` | 通用组件：`SectionTitle`、`StatusSurface`、`CapsuleButton`、`GetButton`、`ScriptIcon`、`Tag`、`FootNote` 等 |
| `store-page.tsx` | 主页：加载、搜索、热门、收藏分组、显示选项（排序 / 字体） |
| `script-detail-page.tsx` | `ScriptCard`、详情页（头部 + 信息条 + 描述 + 信息）、作者作品页 |
| `publish-page.tsx` | 发布表单 |

## 接口

| 接口 | 用途 |
|---|---|
| `GET /api/plugins` | 脚本列表，`{ success, data: Plugin[] }` |
| `GET /api/config` | `bannerSubtitle`、`warningMessage` 作为页脚声明，失败时用内置声明 |
| `POST /api/upload/submit` | 发布：`name`、`description`、`author`、`url`、`symbol` 或 `icon` |

- 字段清洗：`id` ≤ 0 或缺 `url` 的条目丢弃；字符串统一 trim（部分 `icon` 带换行）。
- 图标优先级：`symbol` → `icon` 为符号名 → SVG URL → 图片 URL → emoji → `shippingbox`。
- `resourceStatus === "VALID"` 时详情显示「链接可访问」。
- 作者字段按 `,`、`，`、`、` 拆分，去掉末尾 `(https://…)`；作者页按名称忽略大小写精确匹配。
- 发布时链接原样提交（站点存储的均为原始 http(s) 链接），安装时再包装为导入链接。

## 数据

| 数据 | 位置 |
|---|---|
| 收藏 `script-store.favorites`（脚本 ID 数组） | 脚本私有 Storage |
| 发布作者名 `script-store.author` | 脚本私有 Storage |
| 界面字体 `script-store.ui-font`（PostScript 名称） | 脚本私有 Storage |

## 页面

- 主页：导航栏中间显示脚本名 Script Store（使用界面字体）；首张卡片上为站点声明 `bannerSubtitle`，下为插件数量「可见数 / 总数」；`warningMessage` 放在全部脚本分组末尾。搜索时隐藏热门与收藏。
- 工具栏：左侧关闭，右侧「显示选项」菜单（排序 + 界面字体）与发布；详情页右侧为收藏与「更多」菜单。
- 详情页参照 App Store：104pt 图标 + 名称 + 作者 + 获取按钮，下方「安装 / 更新 / 来源」信息条；点作者进入作品页。
- 发布前 `Dialog.confirm` 提示将公开提交，提交中禁止下滑关闭。

## 发布

`script.json` 的 `remoteResource` 指向仓库子目录，写 `url`、`autoUpdateInterval` 与空的 `hash`（缺少 `hash` 时 App 不识别远程链接，长按显示为空）；`hash` 的实际值由 App 维护，仓库保持空字符串。
