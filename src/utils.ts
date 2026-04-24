// 簡易 nanoid（CF Workers 環境不能用 Node crypto）
export function nanoid(size = 21): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  return Array.from(bytes, (b) => chars[b % chars.length]).join("")
}
