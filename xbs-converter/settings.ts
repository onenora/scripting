// 导出密码存钥匙串；留空表示导出 XBS 时不写入 password 字段。
const PASSWORD_KEY = "xbs-converter.export-password"

export function readExportPassword(): string {
  return Keychain.get(PASSWORD_KEY) ?? ""
}

export function saveExportPassword(password: string) {
  if (password) Keychain.set(PASSWORD_KEY, password, { synchronizable: false })
  else Keychain.remove(PASSWORD_KEY)
}
