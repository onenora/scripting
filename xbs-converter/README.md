# XBS Converter

香色闺阁书源 XBS 与 JSON 互相转换。导入的书源保存在书源库中，可预览、编辑 JSON，按 StandarReader 2.56.1 硬约束检查，再导出为 XBS 或 JSON。

## 使用

1. 导入 .xbs / .json（可多选，自动识别），或粘贴 JSON、从模板新建；也可在「文件」中分享书源给本脚本。
2. 卡片「JSON」直接打开编辑器（语法高亮、查找替换、格式化 / 压缩）；「详情」管理文件内的各个书源（启用 / 停用、删除、预览）并查看检查结果。
3. 「N 项提示」是按香色 2.56.1 硬约束检查出的问题，分为会闪退、可能无法使用、建议三级；点按标签查看；标「可修复」的项（如 requestInfo 不是字符串）可一键修复，其余去编辑 JSON。
4. 「导出」可选 XBS、JSON 或复制 JSON。导出 XBS 前会解密回读逐字节校验。
5. 卡片左滑重命名或删除；详情中书源左滑启用 / 停用或删除，点按预览单个书源。
6. 右上角「设置」可填写导出密码：导出 XBS 时为每个书源写入 `password` 字段（弱加密，香色中查看或编辑书源需输入密码），书源库与 JSON 导出不受影响。

架构与设计见 [design.md](design.md)。

## 致谢

XBS 算法与书源约束来自 [onenora/minis-skills · xiangse-sources](https://github.com/onenora/minis-skills/tree/main/xiangse-sources)。
