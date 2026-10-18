# Scripting

[Scripting](https://scriptingapp.github.io) App 脚本合集。每个子目录是一个独立脚本项目，可直接导入 App 使用。

## 脚本

| 脚本                                | 说明                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- |
| [GitHub Manager](github-manager/)   | 只读 GitHub 浏览器：Stars、探索、作者主页、本地收藏、Release 订阅与下载 |
| [Fonts Installer](fonts-installer/) | 导入、预览字体并通过描述文件安装，支持可变字体单独字重                  |

## 安装

在 Scripting App 中直接导入脚本目录运行即可。

## 开发

本仓库只放脚本源码，类型声明与实时同步由同级的 `scripting-dev` 工作区提供：

```
ower/
├── scripting/          # 本仓库
│   ├── tsconfig.json   # 引用 ../scripting-dev/dts
│   ├── github-manager/
│   └── fonts-installer/
└── scripting-dev/      # scripting-cli 工作区
    ├── dts/            # App 同步的类型声明
    └── scripts/
        ├── GitHub Manager -> ../../scripting/github-manager
        └── Fonts Installer -> ../../scripting/fonts-installer
```

- 实时同步：在 `scripting-dev` 中运行 `npx scripting-cli start --bonjour`，App 连接后保存即同步。
- 类型检查：在本仓库根目录运行 `npx -p typescript tsc --noEmit -p tsconfig.json`。
- 新增脚本：创建包含 `script.json` 与 `index.tsx` 的目录，并在 `scripting-dev/scripts` 下建立同名软链接。

## 致谢

- [BlackCCCat](https://github.com/BlackCCCat)：Fonts Installer 原作者。

## 约定

- 每个脚本目录包含 `README.md`（用法）与 `design.md`（架构与功能设计）。
- 源码中不写入 Token、密码等敏感信息；凭据存钥匙串，本地数据存脚本私有 Storage。
