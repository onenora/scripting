// XBS = 香色闺阁书源：JSON 字节尾部补 4 字节小端原始长度后整体 XXTEA 加密。
// 移植自 onenora/minis-skills xiangse-sources/scripts/xbs.js，与其逐字节一致。

const XBS_KEY_BYTES = new Uint8Array([
  0xe5, 0x87, 0xbc, 0xe8, 0xa4, 0x86, 0xe6, 0xbb,
  0xbf, 0xe9, 0x87, 0x91, 0xe6, 0xba, 0xa1, 0xe5,
])

const DELTA = 0x9e3779b9

function mx(sum: number, y: number, z: number, p: number, e: number, k: Uint32Array): number {
  return (((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^ ((sum ^ y) + (k[(p & 3) ^ e] ^ z))
}

function bytesToWords(b: Uint8Array): Uint32Array {
  const n = b.length >> 2
  const v = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const o = i << 2
    v[i] = (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
  }
  return v
}

function wordsToBytes(v: Uint32Array): Uint8Array {
  const b = new Uint8Array(v.length << 2)
  for (let i = 0; i < v.length; i++) {
    const w = v[i] >>> 0
    const o = i << 2
    b[o] = w & 0xff
    b[o + 1] = (w >>> 8) & 0xff
    b[o + 2] = (w >>> 16) & 0xff
    b[o + 3] = (w >>> 24) & 0xff
  }
  return b
}

function encryptWords(v: Uint32Array, k: Uint32Array): Uint32Array {
  const n = v.length
  if (n < 2) throw new Error("数据过短，无法加密。")
  let z = v[n - 1] >>> 0
  let y: number
  let sum = 0
  let q = 6 + Math.floor(52 / n)
  while (q-- > 0) {
    sum = (sum + DELTA) >>> 0
    const e = (sum >>> 2) & 3
    for (let p = 0; p < n - 1; p++) {
      y = v[p + 1] >>> 0
      z = (v[p] + mx(sum, y, z, p, e, k)) >>> 0
      v[p] = z
    }
    y = v[0] >>> 0
    z = (v[n - 1] + mx(sum, y, z, n - 1, e, k)) >>> 0
    v[n - 1] = z
  }
  return v
}

function decryptWords(v: Uint32Array, k: Uint32Array): Uint32Array {
  const n = v.length
  if (n < 2) throw new Error("文件过短，不是有效的 XBS。")
  let y = v[0] >>> 0
  let z: number
  let sum = Math.imul(6 + Math.floor(52 / n), DELTA) >>> 0
  while (sum !== 0) {
    const e = (sum >>> 2) & 3
    for (let p = n - 1; p > 0; p--) {
      z = v[p - 1] >>> 0
      v[p] = (v[p] - mx(sum, y, z, p, e, k)) >>> 0
      y = v[p]
    }
    z = v[n - 1] >>> 0
    v[0] = (v[0] - mx(sum, y, z, 0, e, k)) >>> 0
    y = v[0]
    sum = (sum - DELTA) >>> 0
  }
  return v
}

/** 解密 XBS 字节，返回原始 JSON 字节。 */
export function xbsToJsonBytes(xbs: Uint8Array): Uint8Array {
  if (xbs.length % 4 !== 0) throw new Error("文件长度不是 4 的倍数，不是有效的 XBS。")
  const out = wordsToBytes(decryptWords(bytesToWords(xbs), bytesToWords(XBS_KEY_BYTES)))
  const n = out.length - 4
  const m = (out[n] | (out[n + 1] << 8) | (out[n + 2] << 16) | (out[n + 3] << 24)) >>> 0
  if (m < n - 3 || m > n) throw new Error("长度标记不匹配，文件可能已损坏或不是 XBS。")
  return out.slice(0, m)
}

/** JSON 字节 → XBS 字节。 */
export function jsonToXbsBytes(json: Uint8Array): Uint8Array {
  const n = (json.length + 3) & ~3
  const padded = new Uint8Array(n + 4)
  padded.set(json)
  padded[n] = json.length & 0xff
  padded[n + 1] = (json.length >>> 8) & 0xff
  padded[n + 2] = (json.length >>> 16) & 0xff
  padded[n + 3] = (json.length >>> 24) & 0xff
  return wordsToBytes(encryptWords(bytesToWords(padded), bytesToWords(XBS_KEY_BYTES)))
}
