"""Create one static font from a named variable-font instance.

Requires the fonttools package to be importable by the Python runtime; it is not bundled.
"""

import json
import os
import re
import sys

try:
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
except ImportError:
    sys.exit("当前 Python 环境缺少 fonttools，无法生成可变字体的独立字重")


source = os.environ["FONT_INSTALLER_INPUT"]
destination = os.environ["FONT_INSTALLER_OUTPUT"]
axes = json.loads(os.environ["FONT_INSTALLER_AXES"])

font = TTFont(source)
if "fvar" not in font:
    raise ValueError("输入文件不是可变字体")
supported_axes = {axis.axisTag for axis in font["fvar"].axes}
if not axes or not set(axes).issubset(supported_axes):
    raise ValueError("所选字重与字体变体不匹配")

instance = instantiateVariableFont(font, axes, inplace=False, updateFontNames=True)
family = os.environ["FONT_INSTALLER_FAMILY"]
style = os.environ["FONT_INSTALLER_STYLE"]
full_name = os.environ["FONT_INSTALLER_FULL_NAME"]
postscript = os.environ["FONT_INSTALLER_POSTSCRIPT"]
if not re.fullmatch(r"[A-Za-z0-9._-]+", postscript):
    raise ValueError("生成的 PostScript 名称无效")

# FontTools may keep the variable font's original PostScript name for some
# named instances. Give every static payload its own stable identity.
name_table = instance["name"]
replacement_names = {
    1: family,
    2: style,
    4: full_name,
    6: postscript,
    16: family,
    17: style,
}
name_table.names = [record for record in name_table.names if record.nameID not in replacement_names]
for name_id, value in replacement_names.items():
    name_table.setName(value, name_id, 3, 1, 0x0409)
    name_table.setName(value, name_id, 0, 3, 0)

instance.save(destination)
