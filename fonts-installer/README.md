# Fonts Installer

导入、验证、预览 TrueType / OpenType 字体，生成 iOS 配置描述文件逐个安装。支持可变字体单独字重、安装历史、把已安装字体应用为界面字体，以及从快捷指令或分享表单传入字体文件。

## 使用

1. 导入 .ttf / .otf（不支持 .ttc / .otc），预览后点按「安装到系统」；左滑可取消。
2. 按系统提示在「设置」中确认安装描述文件；删除字体也在「设置」的描述文件页面移除。
3. 「安装历史」记录安装过的字体，右上角 + 可添加系统已安装字体；左滑删除记录，或「应用」为界面字体（再次左滑「还原」）。

可变字体（一个文件含多种字重）会拆成多张卡片，安装其中一张时用 Python 包 `fonttools` 生成该字重的独立字体；缺少时会提示通过 pip 安装，失败时请在 App 的 Python 包管理中安装。普通字体不需要。

架构与设计见 [design.md](design.md)。

## 致谢

基于 [BlackCCCat/Scripting-Scripts · Fonts-Installer](https://github.com/BlackCCCat/Scripting-Scripts/tree/main/Fonts-Installer) 二次开发（MIT，见 [LICENSE](LICENSE)）。
