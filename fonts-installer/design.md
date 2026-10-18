# Fonts Installer 设计

## 原则

- **系统接管安装**：字体打包为 iOS 配置描述文件，由本地服务交给 Safari 下载，用户在「设置」中确认。
- **本地处理**：字体只在本机解析与转换，历史只记录名称等元数据，不保存字体文件。
- **依赖按需**：fonttools 不随脚本内置，仅在实例化可变字体时检查并安装。

## 运行结构

```
index.tsx
└─ Navigation.present(FontsInstaller)   # 单页 List
   ├─ InstallSection   字体安装：导入、预览、安装，左滑取消
   └─ HistorySection   安装历史：预览、复制，左滑删除 / 应用为界面字体
intent.tsx
└─ SharedFontInstallView               # 快捷指令 / 分享表单传入单个字体
```

`FontsInstaller` 持有字体历史与界面字体：安装成功后由 `InstallSection` 回写历史；界面字体变化时作为 props 传给两个分组触发重绘。

## 模块

| 模块 | 职责 |
|---|---|
| `font.ts` | 解析 TTF / OTF：名称表、格式、中文字形、可变字体命名实例 |
| `font-instance.ts` / `font-instance.py` | 可变字体实例化为独立字重（fonttools），缺失时 pip 安装 |
| `profile.ts` | 生成字体描述文件并通过本地服务交给系统 |
| `preview.ts` | 导入字体的 WebView 样张 |
| `installed-font-preview.tsx` | 已安装字体的原生样张 |
| `font-history.ts` | 字体历史存储（最多 100 条） |
| `shared-font.ts` | 清理分享传入文件的书签 |
| `glass-ui.tsx` | 通用组件与界面字体：`SectionTitle`、`StatusSurface`、`CapsuleButton`、`DetailRow`、`FootNote`、`uiFont` 等 |
| `install-section.tsx` / `history-section.tsx` | 主页两个分组 |
| `shared-install-view.tsx` | 分享传入字体的预览安装页，多字重时顶部切换 |

## 可变字体

一个可变字体文件包含多个字重（如 `NotoSansSC-VariableFont_wght.ttf` 含 Thin 到 Black）。导入时按命名实例拆成多张「可变字重」卡片；安装某一张时，`font-instance.py` 用 fonttools 生成只含该字重、名称唯一的静态字体，再打包为描述文件。整个可变字体直接安装时，其他 App 通常只能用默认字重。普通静态字体（标「已验证」）不经过这一步。

fonttools 缺失时先确认并执行 `pip install fonttools`，失败则提示在 App 的 Python 包管理中安装。

## 数据

| 数据 | 位置 |
|---|---|
| 字体历史 `font-install-history:v1` | 脚本私有 Storage |
| 界面字体 `fonts-installer.ui-font`（PostScript 名称） | 脚本私有 Storage |
| 预览、实例化临时文件 | 临时目录，用完即删 |

## 界面约定

- 与 GitHub Manager 一致：系统分组背景 + 透明玻璃卡片，颜色使用系统语义色，主色 `systemIndigo`。
- 分组第一行为 `SectionTitle`（图标 + 标题 + 状态，左对齐），右侧放操作图标；空状态卡片自带主操作时，标题行不重复放同一入口。
- 需要左滑的卡片各自成为一行（`trailingSwipeActions`），用 `listRowInsets` 控制卡片间距；List 行内按钮使用 `borderless`。
- 分组说明用 `FootNote` 作为最后一行，不用 Section `footer`（最后一组的 footer 会悬浮在底部）。
- 界面文字统一通过 `uiFont(size)` 取字体：历史左滑「应用」后整页改用该字体，「还原」恢复系统字体；字体预览页始终显示被预览的字体。导航栏标题与左滑按钮由系统绘制，不受影响。
- SF Symbol `textformat` 系列在中文环境会本地化成汉字，界面内字体图标用 `f.cursive`。

## 发布

`script.json` 的 `remoteResource` 指向仓库子目录，只写 `url` 与 `autoUpdateInterval`，`hash` 由 App 生成，不提交。
