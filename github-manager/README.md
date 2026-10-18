# GitHub Manager

只读 GitHub 浏览器，所有请求均为 GET，不会修改 GitHub 上的任何内容。

## 功能

- **探索**：热门开源仓库与搜索
- **收藏**：本地收藏仓库，与账户无关
- **Stars**：任意用户的 Star 列表，分页加载，支持置顶
- **Releases**：订阅仓库新版本，资产下载
- **设置**：切换浏览用户（带浏览记录）、GitHub Token 管理、Raw 链接转换

仓库内可浏览文件（预览 Markdown、代码、图片）、提交历史、Actions、Pull Request 与 Releases。

## 使用

1. 导入 Scripting 并运行。
2. 在「设置」中填写 GitHub 用户名（公共浏览，每小时 60 次），或添加 Token（授权浏览，每小时 5000 次，可读自己的私有仓库）。

Token 只需读取权限：

- **Fine-grained**：Public repositories + Starring：Read-only；需要私有仓库时加 Contents、Actions、Pull requests：Read-only。
- **Classic**：不勾选 scope；需要私有仓库时勾选 `repo`。

## 隐私

Token 存于 iOS 钥匙串（仅此设备、不同步 iCloud），其余数据存于脚本私有 Storage，下载文件在 `Documents/GitHub Releases`。分享脚本只包含源码与说明文件，不含以上数据。

架构与设计见 [design.md](design.md)。
