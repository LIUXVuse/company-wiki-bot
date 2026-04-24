export interface Env {
  // D1 資料庫
  DB: D1Database
  // R2 bucket
  BUCKET: R2Bucket
  // 環境變數
  COMPANY_NAME: string
  LLM_PROVIDER: string
  LLM_MODEL: string
  LLM_BASE_URL: string
  MINERU_USE_API: string
  // Secrets
  TELEGRAM_BOT_TOKEN: string
  LLM_API_KEY: string
  MINERU_API_TOKEN: string
}

export const TELEGRAM_API = "https://api.telegram.org"

// 允許上傳文件的管理員 Telegram user ID
// 部署前在這裡填入自己的 ID（用 /start 指令取得）
export const ADMIN_IDS: number[] = [
  971784686,
]

export const CATEGORIES = ["products", "iso", "legal", "faq"] as const
export type Category = typeof CATEGORIES[number]

export const CATEGORY_NAMES: Record<Category, string> = {
  products: "產品說明",
  iso: "ISO 文件",
  legal: "法規/政府函文",
  faq: "常見問答",
}
