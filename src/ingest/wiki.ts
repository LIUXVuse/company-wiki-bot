import { callLLM } from "./llm"
import { saveMarkdown } from "../storage/r2"
import { upsertWikiPage } from "../storage/d1"
import type { Env, Category } from "../config"
import { CATEGORIES } from "../config"
import { nanoid } from "../utils"

export interface WikiPageData {
  id: string
  title: string
  category: Category
  r2Key: string
  summary: string
  content: string
}

// 把 MinerU 轉出來的 markdown 處理成 wiki 頁面
export async function processMarkdownToWiki(
  env: Env,
  markdown: string,
  sourceFilename: string
): Promise<WikiPageData[]> {
  const companyName = env.COMPANY_NAME

  // Step 1：讓 LLM 分析文件，決定分類並產生 wiki 頁面
  const analysisPrompt = `你是 ${companyName} 的知識庫管理員。

以下是從文件「${sourceFilename}」轉換出來的內容：

---
${markdown.slice(0, 6000)}
---

請分析這份文件，輸出 JSON 格式（只輸出 JSON，不要其他文字）：

{
  "pages": [
    {
      "title": "頁面標題",
      "category": "iso",
      "summary": "一句話摘要（50字以內）",
      "content": "完整的 markdown 內容，整理成結構清晰的知識頁面"
    }
  ]
}

category 只能是以下之一：${CATEGORIES.join(" | ")}
- products：產品說明書、規格、同意書
- iso：ISO 文件、作業程序、品質手冊
- legal：政府函文、法規、合約
- faq：常見問答

一份文件可以拆成多個頁面（如果涵蓋多個主題）。
每個頁面的 content 要：
1. 保留原始資訊，不要亂編
2. 用 markdown 標題（##、###）組織結構
3. 重要數字、日期、規定用粗體標示`

  const raw = await callLLM(env, [{ role: "user", content: analysisPrompt }])

  // 解析 JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("LLM 沒有回傳有效 JSON")

  const parsed = JSON.parse(jsonMatch[0]) as {
    pages: { title: string; category: string; summary: string; content: string }[]
  }

  const results: WikiPageData[] = []

  for (const page of parsed.pages) {
    const category = CATEGORIES.includes(page.category as Category)
      ? (page.category as Category)
      : "faq"

    const id = nanoid()
    const slug = slugify(page.title)
    const r2Key = `wiki/${category}/${slug}.md`

    // 在 content 頂部加上 frontmatter
    const fullContent = `# ${page.title}\n\n> 來源：${sourceFilename}\n\n${page.content}`

    // 存到 R2
    await saveMarkdown(env, r2Key, fullContent)

    // 更新 D1 索引
    await upsertWikiPage(env, {
      id,
      title: page.title,
      category,
      r2_key: r2Key,
      source_file: sourceFilename,
      summary: page.summary,
    })

    results.push({ id, title: page.title, category, r2Key, summary: page.summary, content: fullContent })
  }

  return results
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u4e00-\u9fff]+/g, "_")
    .replace(/[^\w_]/g, "")
    .slice(0, 60)
    || nanoid(8)
}
