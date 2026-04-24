import type { Env } from "../config"
import { ADMIN_IDS, TELEGRAM_API } from "../config"
import { handleDocument } from "./commands"
import { handleQuery } from "./query"

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name: string; username?: string }
  chat: { id: number; type: string }
  text?: string
  document?: {
    file_id: string
    file_name?: string
    mime_type?: string
    file_size?: number
  }
}

export async function handleUpdate(env: Env, update: TelegramUpdate): Promise<void> {
  const msg = update.message
  if (!msg) return

  const chatId = msg.chat.id
  const userId = msg.from?.id

  // 管理員指令：上傳文件
  if (msg.document) {
    if (!userId || !ADMIN_IDS.includes(userId)) {
      await sendMessage(env, chatId, "⚠️ 只有管理員可以上傳文件。")
      return
    }
    await handleDocument(env, msg)
    return
  }

  // 一般用戶：問問題
  if (msg.text) {
    if (msg.text === "/start") {
      await sendMessage(
        env,
        chatId,
        `👋 歡迎使用 ${env.COMPANY_NAME} 知識庫！\n\n直接輸入問題，我會從公司文件中找答案。\n\n你的 ID：${userId}`
      )
      return
    }

    if (msg.text === "/help") {
      await sendMessage(
        env,
        chatId,
        `📚 使用說明\n\n直接輸入問題即可，例如：\n• 防火門的維護週期是多久？\n• ISO 9001 文件在哪裡更新？\n• 產品保固條款是什麼？`
      )
      return
    }

    await handleQuery(env, msg)
  }
}

// 發送純文字訊息
export async function sendMessage(env: Env, chatId: number, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  })
}

// 發送圖片
export async function sendPhoto(env: Env, chatId: number, imageData: ArrayBuffer, caption?: string): Promise<void> {
  const formData = new FormData()
  formData.append("chat_id", String(chatId))
  formData.append("photo", new Blob([imageData], { type: "image/png" }), "image.png")
  if (caption) formData.append("caption", caption)

  await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: formData,
  })
}
