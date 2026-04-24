import type { Env } from "../config"
import type { Category } from "../config"

export interface WikiPage {
  id: string
  title: string
  category: Category
  r2_key: string
  source_file: string | null
  summary: string | null
  created_at: number
  updated_at: number
}

export interface WikiImage {
  id: string
  page_id: string
  r2_key: string
  caption: string | null
}

// 新增或更新 wiki 頁面（同名覆蓋）
export async function upsertWikiPage(env: Env, page: Omit<WikiPage, "created_at" | "updated_at">): Promise<void> {
  const now = Date.now()
  await env.DB.prepare(`
    INSERT INTO wiki_pages (id, title, category, r2_key, source_file, summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(r2_key) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      updated_at = excluded.updated_at
  `).bind(page.id, page.title, page.category, page.r2_key, page.source_file, page.summary, now, now).run()
}

// 儲存圖片索引
export async function saveImageIndex(env: Env, image: Omit<WikiImage, never>): Promise<void> {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO wiki_images (id, page_id, r2_key, caption)
    VALUES (?, ?, ?, ?)
  `).bind(image.id, image.page_id, image.r2_key, image.caption).run()
}

// 搜尋相關頁面（用 summary 做簡單關鍵字搜尋）
export async function searchPages(env: Env, query: string, limit = 5): Promise<WikiPage[]> {
  const keywords = query.split(/\s+/).filter(Boolean)
  if (keywords.length === 0) return []

  // 用第一個關鍵字先過濾，其餘由 LLM 判斷
  const keyword = `%${keywords[0]}%`
  const result = await env.DB.prepare(`
    SELECT * FROM wiki_pages
    WHERE title LIKE ? OR summary LIKE ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(keyword, keyword, limit).all<WikiPage>()

  return result.results
}

// 取得某分類的所有頁面
export async function getPagesByCategory(env: Env, category: Category): Promise<WikiPage[]> {
  const result = await env.DB.prepare(`
    SELECT * FROM wiki_pages WHERE category = ? ORDER BY updated_at DESC
  `).bind(category).all<WikiPage>()
  return result.results
}

// 取得頁面的所有圖片
export async function getPageImages(env: Env, pageId: string): Promise<WikiImage[]> {
  const result = await env.DB.prepare(`
    SELECT * FROM wiki_images WHERE page_id = ?
  `).bind(pageId).all<WikiImage>()
  return result.results
}

// 記錄上傳任務
export async function createSourceFile(env: Env, id: string, filename: string, r2_key: string): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO source_files (id, filename, r2_key, status, created_at)
    VALUES (?, ?, ?, 'processing', ?)
  `).bind(id, filename, r2_key, Date.now()).run()
}

export async function updateSourceFileStatus(
  env: Env,
  id: string,
  status: "done" | "error",
  pagesCreated?: number,
  errorMsg?: string
): Promise<void> {
  await env.DB.prepare(`
    UPDATE source_files SET status = ?, pages_created = ?, error_msg = ? WHERE id = ?
  `).bind(status, pagesCreated ?? 0, errorMsg ?? null, id).run()
}
