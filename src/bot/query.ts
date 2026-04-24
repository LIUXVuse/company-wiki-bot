import type { Env } from "../config"
import type { TelegramMessage } from "./handler"
import { sendMessage, sendPhoto } from "./handler"
import { callLLM } from "../ingest/llm"
import { searchPages, getPageImages } from "../storage/d1"
import { readMarkdown, getImageBytes } from "../storage/r2"

export async function handleQuery(env: Env, msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id
  const question = msg.text!

  try {
    // Step 1：搜尋相關 wiki 頁面
    const pages = await searchPages(env, question, 5)

    if (pages.length === 0) {
      await sendMessage(
        env,
        chatId,
        `找不到相關資料。\n\n如果需要新增知識，請請管理員上傳相關文件。`
      )
      return
    }

    // Step 2：讀取頁面內容
    const contextParts: string[] = []
    for (const page of pages) {
      const content = await readMarkdown(env, page.r2_key)
      if (content) {
        contextParts.push(`### ${page.title}\n${content}`)
      }
    }

    // Step 3：LLM 根據 wiki 內容回答
    const systemPrompt = `你是 ${env.COMPANY_NAME} 的客服助理。
根據以下公司知識庫內容回答用戶問題。
只根據提供的資料回答，不要編造資訊。
如果資料中找不到答案，誠實說明並建議聯繫相關部門。
回答請簡潔清楚，使用繁體中文。`

    const userPrompt = `知識庫資料：
${contextParts.join("\n\n---\n\n")}

---

用戶問題：${question}`

    const answer = await callLLM(env, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ])

    await sendMessage(env, chatId, answer)

    // Step 4：如果有相關圖片，一併發送
    for (const page of pages) {
      const images = await getPageImages(env, page.id)
      for (const img of images.slice(0, 2)) { // 最多發 2 張
        const imgData = await getImageBytes(env, img.r2_key)
        if (imgData) {
          await sendPhoto(env, chatId, imgData, img.caption ?? undefined)
        }
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await sendMessage(env, chatId, `❌ 查詢失敗：${errMsg}`)
  }
}
