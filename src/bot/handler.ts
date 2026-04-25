import type { Env } from "../config"
import { ADMIN_IDS, TELEGRAM_API } from "../config"
import { handleDocument, handleAdminCommand } from "./commands"
import { handleQuery } from "./query"
import { isUserAllowed } from "../storage/d1"

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
  if (!userId) return

  const isAdmin = ADMIN_IDS.includes(userId)
  const isPrivate = env.BOT_ACCESS === "private"

  // 存取控制：private 模式下，非 admin 且不在白名單 → 拒絕
  if (isPrivate && !isAdmin) {
    const allowed = await isUserAllowed(env, userId)
    if (!allowed) {
      await sendMessage(env, chatId, `🔒 此服務僅限授權用戶使用。\n\n請聯繫管理員申請存取權限，並提供你的 ID：\`${userId}\``)
      return
    }
  }

  // 管理員：上傳文件
  if (msg.document) {
    if (!isAdmin) {
      await sendMessage(env, chatId, "⚠️ 只有管理員可以上傳文件。")
      return
    }
    await handleDocument(env, msg)
    return
  }

  if (msg.text) {
    // /start
    if (msg.text === "/start") {
      const modeTag = isPrivate ? "🔒 私人模式" : "🌐 公開模式"
      await sendMessage(
        env, chatId,
        `👋 歡迎使用 *${env.COMPANY_NAME}* 知識庫！\n\n直接輸入問題，我會從公司文件中找答案。\n\n你的 ID：\`${userId}\`\n狀態：${modeTag}`
      )
      return
    }

    // /help
    if (msg.text === "/help") {
      const adminHelp = isAdmin ? `\n\n*管理員指令：*\n/list — 列出所有知識頁面\n/delete <ID> — 刪除指定頁面\n/allow <用戶ID> — 加入白名單\n/deny <用戶ID> — 移出白名單\n/users — 查看白名單` : ""
      await sendMessage(
        env, chatId,
        `📚 *使用說明*\n\n直接輸入問題即可，例如：\n• 電刀的操作規範？\n• ISO 文件最新版本？\n• 產品保固條款？${adminHelp}`
      )
      return
    }

    // 管理員專屬指令（/list /delete /allow /deny /users）
    if (isAdmin && msg.text.startsWith("/")) {
      await handleAdminCommand(env, msg)
      return
    }

    // 一般問答
    await handleQuery(env, msg)
  }
}

// 發送 Markdown 訊息（標題/內容可能含特殊字元時用 sendPlainMessage）
export async function sendMessage(env: Env, chatId: number, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  })
}

// 發送純文字訊息（不套 Markdown，用於列表等可能含特殊符號的場合）
export async function sendPlainMessage(env: Env, chatId: number, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
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
