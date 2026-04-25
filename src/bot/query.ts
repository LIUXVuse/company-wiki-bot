import type { Env } from "../config"
import type { TelegramMessage } from "./handler"
import { sendMessage, sendPhoto } from "./handler"
import { callLLM } from "../ingest/llm"
import { getAllPageSummaries, getPageImages } from "../storage/d1"
import { readMarkdown, getImageBytes } from "../storage/r2"

export async function handleQuery(env: Env, msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id
  const question = msg.text!

  try {
    // Step 1：取得所有頁面摘要清單
    const allPages = await getAllPageSummaries(env)

    // Step 2：讓 LLM 從摘要中挑出最相關的頁面（最多 3 個，摘要清單上限 80 頁）
    let relevantPages: typeof allPages = []
    if (allPages.length > 0) {
      const summaryList = allPages.slice(0, 80)
        .map((p, i) => `[${i}] ${p.title}：${p.summary ?? "無摘要"}`)
        .join("\n")

      const pickPrompt = `以下是知識庫中所有頁面的清單：\n${summaryList}\n\n用戶的問題是：「${question}」\n\n請回覆與問題最相關的頁面編號（最多3個），只輸出數字，用逗號分隔，例如：0,3,7。如果沒有任何相關頁面，回覆「none」。`
      const picked = await callLLM(env, [{ role: "user", content: pickPrompt }])
      const indices = picked.match(/\d+/g)?.map(Number).filter(n => n < allPages.length) ?? []
      relevantPages = indices.slice(0, 3).map(i => allPages[i])
    }

    // Step 3：讀取選出頁面的完整內容
    const contextParts: string[] = []
    for (const page of relevantPages) {
      const content = await readMarkdown(env, page.r2_key)
      if (content) {
        contextParts.push(`### ${page.title}\n${content}`)
      }
    }

    // Step 4：組 system prompt
    const systemPrompt = `你是「${env.COMPANY_NAME}」的 AI 助理，親切、專業、回答簡潔。
無論參考資料是什麼語言，請一律使用繁體中文回覆，不可使用簡體中文。

回答原則：
- 如果知識庫有相關資料，優先根據資料回答，並說明來源頁面標題。
- 如果知識庫沒有相關資料，用你自己的知識合理回答，但要提醒「以下為一般性建議，非本公司規定」。
- 打招呼、閒聊、問候 → 正常友善回應，不用查知識庫。
- 不要捏造公司規定或數據。

重要：資料中可能有多層交叉條件，例如「符合 A 資格者可擔任 B」，A 的定義在同一份或其他段落。
請仔細追蹤每一個條件分支，尤其是「符合 XX 資格者」這類交叉引用，完整推導後再給答案。`

    // Step 5：組 user prompt
    const userPrompt = contextParts.length > 0
      ? `【知識庫參考資料】\n${contextParts.join("\n\n---\n\n")}\n\n---\n\n用戶說：${question}`
      : question

    const answer = await callLLM(env, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ])

    await sendMessage(env, chatId, answer)

    // Step 6：有相關圖片一併發送
    for (const page of relevantPages) {
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
