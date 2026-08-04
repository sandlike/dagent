// 生成 K8s 资源名友好的短随机 ID（小写字母+数字）
// 例：7f3k2x（6 位，约 21 亿组合，单用户场景够用）
export function randomShortId(len = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  // 首字符避免数字（部分 K8s 资源名限制要求首字符是字母，由调用方前缀 "ag-" 保证）
  let s = ''
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  for (let i = 0; i < len; i++) {
    s += alphabet[buf[i] % alphabet.length]
  }
  return s
}
