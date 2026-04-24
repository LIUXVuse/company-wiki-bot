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
    // Step 1：搜尋相關 wiki 頁面（找不到也繼續，讓 LLM 處理）
    const pages = await searchPages(env, question, 5)

    // Step 2：讀取頁面內容（有的話）
    const contextParts: string[] = []
    for (const page of pages) {
      const content = await readMarkdown(env, page.r2_key)
      if (content) {
        contextParts.push(`### ${page.title}\n${content}`)
      }
    }

    // Step 3：組 system prompt
    const systemPrompt = `你是「${env.COMPANY_NAME}」的 AI 助理，親切、專業、回答簡潔。
使用繁體中文回覆。

回答原則：
- 如果知識庫有相關資料，優先根據資料回答，並說明來源頁面標題。
- 如果知識庫沒有相關資料，用你自己的知識合理回答，但要提醒「以下為一般性建議，非本公司規定」。
- 打招呼、閒聊、問候 → 正常友善回應，不用查知識庫。
- 不要捏造公司規定或數據。`

    // Step 4：組 user prompt（有 wiki 內容才附上）
    const userPrompt = contextParts.length > 0
      ? `【知識庫參考資料】\n${contextParts.join("\n\n---\n\n")}\n\n---\n\n用戶說：${question}`
      : question

    const answer = await callLLM(env, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ])

    await sendMessage(env, chatId, answer)

    // Step 5：有相關圖片一併發送
    for (const page of pages) {
      const images = await getPageImages(env, page.id)
      for (const img of images.slice(0, 2)) {
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
