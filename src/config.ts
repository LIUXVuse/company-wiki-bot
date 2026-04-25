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
  BOT_ACCESS: string        // "public" | "private"
  WIKI_CATEGORIES: string   // JSON: [{"key":"policy","name":"政策法規","desc":"..."}]
  // Secrets
  TELEGRAM_BOT_TOKEN: string
  LLM_API_KEY: string
  MINERU_API_TOKEN: string
  INGEST_SECRET: string
}

export const TELEGRAM_API = "https://api.telegram.org"

export const ADMIN_IDS: number[] = [
  971784686,
]

// 分類定義（runtime，從 env 讀取）
export interface CategoryDef {
  key: string
  name: string
  desc: string  // 給 LLM 看的說明
}

export type Category = string

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { key: "policy",    name: "政策法規",   desc: "政府函文、法規、公文" },
  { key: "procedure", name: "作業程序",   desc: "SOP、作業流程、指導原則" },
  { key: "staff",     name: "人員資格",   desc: "人員訓練、認證、資格規定" },
  { key: "billing",   name: "費用給付",   desc: "收費標準、給付基準、審核規定" },
  { key: "faq",       name: "常見問答",   desc: "常見問題與解答" },
]

export function getCategories(env: Env): CategoryDef[] {
  try {
    if (env.WIKI_CATEGORIES) return JSON.parse(env.WIKI_CATEGORIES)
  } catch {}
  return DEFAULT_CATEGORIES
}

// 相容舊版：取得分類 key 列表
export function getCategoryKeys(env: Env): string[] {
  return getCategories(env).map(c => c.key)
}

// 相容舊版：取得 key → name 對照表
export function getCategoryNames(env: Env): Record<string, string> {
  return Object.fromEntries(getCategories(env).map(c => [c.key, c.name]))
}
