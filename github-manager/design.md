# GitHub Manager 设计

## 原则

- **只读**：所有请求均为 GET，界面不提供任何写操作。
- **浏览对象与 Token 解耦**：浏览谁由用户名决定；Token 只用于放宽限额（60 → 5000 次/小时）和读取 Token 所属账户的私有仓库。
- **省额度**：公共浏览不自动请求，GET 结果持久化缓存；每个浏览用户的资料与 Star 按用户保存，切换回来直接显示。
- **本地数据不外泄**：Token 只在钥匙串，其余数据在脚本私有 Storage，均不在脚本目录内。

## 运行结构

```
index.tsx
└─ Navigation.present(StarredPage)      # 循环呈现，支持弹窗 / 全面屏切换
   └─ TabView (sidebarAdaptable)       # iPhone 底部标签栏，iPad / Mac 可收起侧边栏
      ├─ 探索      ExplorePage
      ├─ 收藏      FavoritesPage
      ├─ Stars     StarredPage 内的列表
      ├─ Releases  ReleaseTrackerPage
      └─ 设置      AccountPage
```

`home_screen_default_ui.tsx` 把同一个 `StarredPage` 作为 Scripting 首页标签显示（`homeScreen` 模式只显示 Stars 列表，避免与 App 标签栏嵌套），生命周期由 App 托管。

`StarredPage` 持有全局状态（浏览方式、浏览对象资料、Star 列表、Token 元数据），通过 `AccountActions` 把操作交给设置页及其二级页。右上角按钮以 `dismiss({ type: "change-presentation-style" })` 让 `index.tsx` 以新样式重新呈现。

## 模块

| 模块 | 职责 |
|---|---|
| `github-api.ts` | REST 请求（超时、错误映射）、Token 存取与暂停、公共缓存、按用户快照、浏览记录 |
| `types.ts` | 领域类型 |
| `glass-ui.tsx` | 玻璃风格通用组件：`StatusSurface`、`SettingRow`、`IconButton`、`ModeBadge` 等 |
| `repository-browser.tsx` | 仓库行菜单、作者主页 `OwnerPage`、资料卡 `OwnerProfileCard` |
| `repository-pages.tsx` | 仓库内页面：文件、预览、提交、Actions、PR、Releases、下载管理 |
| `account-page.tsx` | 设置页、`GitHub Token 管理` 二级页 |
| `browse-switcher-page.tsx` | 切换浏览用户：输入用户名、本人、浏览记录与删除 |
| `starred-page.tsx` | 根页面与 Stars 列表 |
| `explore-page.tsx` / `favorites-page.tsx` / `my-repositories-page.tsx` | 对应标签页与我的仓库 |
| `favorites.ts` / `pinned-repositories.ts` / `release-tracker.ts` | 收藏、置顶、Release 订阅的本地存储 |
| `raw-link.ts` / `raw-link-page.tsx` | GitHub 链接转 Raw 链接 |

## 浏览方式

| 方式 | 条件 | 浏览对象 |
|---|---|---|
| 未连接 | 无用户名、无可用 Token | 显示二选一引导 |
| 公共浏览 | 有用户名、无可用 Token | 该用户名 |
| 授权浏览 | 有可用 Token | 用户名；未设置时为 Token 所属账户（本人） |

- 授权浏览下浏览本人时 Stars 走 `/user/starred`，「仓库」打开含私有仓库的我的仓库；浏览他人时走 `/users/{login}/starred`，请求同样带 Token。
- 资料卡胶囊：授权浏览显示「本人 / 他人」，公共浏览显示「用户」，组织显示「组织」。
- 输入的用户名等于 Token 所属账户时自动清除用户名，统一按本人处理。

## Token

- 钥匙串键 `github-star.access-token`，优先 `passcode`（需设备密码），无设备密码时退回 `unlocked_this_device`；均不同步 iCloud。
- 保存前请求 `/user` 验证，401 直接删除不保存；验证时记录过期时间与所属账户 `login`。
- 「退出授权」写入暂停标记，Token 保留，可恢复；「删除 Token」从钥匙串移除并清除元数据。
- `Authorization` 头只在 `authHeaders` 中添加，只发往 `api.github.com`。

## 数据与缓存

| 数据 | 位置 |
|---|---|
| Token | 钥匙串 |
| 用户名、Token 元数据、暂停标记、呈现样式 | Storage |
| 用户快照 `github-star.user-snapshot.<login>`：资料、Star、下一页页码、同步时间 | Storage |
| 浏览记录 `github-star.browse-history`（最多 30 个，超出连同快照清除） | Storage |
| 公共缓存：搜索 30 分钟、仓库 12 小时、用户 24 小时，最多 300 条 | Storage，仅公共浏览读写 |
| 收藏、置顶、Release 订阅与缓存 | Storage |
| Release 资产 | `Documents/GitHub Releases` |

- 切换浏览用户：写用户名 → 读该用户快照显示 → 无快照时才请求。删除浏览记录同时删除其快照；当前用户不可删除。
- 请求期间浏览对象变化时丢弃结果，避免写入其他用户的快照。

## Stars 分页

每次请求 100 个（与 20 个同样消耗 1 次额度），界面每批渲染 20 个。「加载更多」先展开本地数据，不足一批时才请求下一页；刷新只请求第一页。

## 发布

`script.json` 的 `remoteResource` 指向仓库子目录，App 据此从 GitHub 同步，字段顺序保持不变：

```json
"remoteResource" : {
  "autoUpdateInterval" : null,
  "url" : "https:\/\/github.com\/onenora\/scripting\/github-manager"
},
```

只写 `url` 与 `autoUpdateInterval`；`hash` 由 App 内部生成，不提交。
