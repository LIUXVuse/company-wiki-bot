import type { Env } from "../config"
import { getCategoryNames } from "../config"
import type { TelegramMessage } from "./handler"
import { sendMessage, sendPlainMessage } from "./handler"
import { convertWithMinerU } from "../ingest/mineru"
import { processMarkdownToWiki } from "../ingest/wiki"
import { saveRawFile } from "../storage/r2"
import { deleteWikiPageFromR2 } from "../storage/r2"
import {
  createSourceFile, updateSourceFileStatus,
  listAllPages, deleteWikiPage,
  addAllowedUser, removeAllowedUser, listAllowedUsers,
} from "../storage/d1"
import { nanoid } from "../utils"
import { TELEGRAM_API } from "../config"

// 管理員上傳文件的處理流程
export async function handleDocument(env: Env, msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id
  const doc = msg.document!
  const filename = doc.file_name ?? "unknown_file"

  // 大小檢查（輕量 API 限 10MB）
  const fileSizeMB = (doc.file_size ?? 0) / 1024 / 1024
  const isOversized = fileSizeMB > 10

  await sendMessage(env, chatId, `📄 收到文件：${filename}\n正在處理中，請稍候⋯`)

  try {
    // Step 1：從 Telegram 下載檔案
    const fileData = await downloadTelegramFile(env, doc.file_id)

    // Step 2：備份到 R2
    const rawKey = await saveRawFile(env, filename, fileData, doc.mime_type ?? "application/octet-stream")
    const taskId = nanoid()
    await createSourceFile(env, taskId, filename, rawKey)

    if (isOversized) {
      await sendMessage(env, chatId, `⚠️ 檔案超過 10MB，請使用本地 MinerU 處理後上傳 .md 檔。`)
      await updateSourceFileStatus(env, taskId, "error", 0, "檔案超過 10MB")
      return
    }

    // Step 3：MinerU 轉換
    console.log(`[ingest] start MinerU: ${filename}`)
    const { markdown } = await convertWithMinerU(env, fileData, filename)
    console.log(`[ingest] MinerU done, md length: ${markdown.length}`)

    // Step 4：LLM 整理成 wiki 頁面
    console.log(`[ingest] start LLM wiki processing`)
    const pages = await processMarkdownToWiki(env, markdown, filename)
    console.log(`[ingest] LLM done, pages: ${pages.length}`)

    await updateSourceFileStatus(env, taskId, "done", pages.length)

    const pageList = pages.map((p) => `• [${p.category}] ${p.title}`).join("\n")
    await sendMessage(
      env,
      chatId,
      `✅ 處理完成！新增了 ${pages.length} 個知識頁面：\n\n${pageList}`
    )
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await sendMessage(env, chatId, `❌ 處理失敗：${errMsg}`)
  }
}

// 管理員文字指令處理
export async function handleAdminCommand(env: Env, msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id
  const userId = msg.from!.id
  const text = msg.text!.trim()
  const [cmd, ...args] = text.split(/\s+/)

  // /list — 列出所有 wiki 頁面
  if (cmd === "/list") {
    const pages = await listAllPages(env)
    if (pages.length === 0) {
      await sendMessage(env, chatId, "📭 知識庫目前是空的。")
      return
    }
    const categoryNames = getCategoryNames(env)
    const lines = pages.map((p, i) =>
      `${i + 1}. (${categoryNames[p.category] ?? p.category}) ${p.title}\n   ID: \`${p.id}\``
    )
    // Telegram 訊息有長度限制，每 20 筆分一批（純文字，避免標題特殊符號破壞 Markdown）
    for (let i = 0; i < lines.length; i += 20) {
      await sendPlainMessage(env, chatId, `📚 知識頁面（${i+1}–${Math.min(i+20, lines.length)}）\n\n${lines.slice(i, i+20).join("\n\n")}`)
    }
    return
  }

  // /delete <ID> — 刪除 wiki 頁面
  if (cmd === "/delete") {
    const id = args[0]
    if (!id) {
      await sendMessage(env, chatId, "用法：`/delete <頁面ID>`\n先用 `/list` 查詢 ID。")
      return
    }
    const page = await deleteWikiPage(env, id)
    if (!page) {
      await sendMessage(env, chatId, `找不到 ID 為 \`${id}\` 的頁面。`)
      return
    }
    // 同時從 R2 刪除 markdown 檔
    await deleteWikiPageFromR2(env, page.r2_key)
    await sendMessage(env, chatId, `🗑️ 已刪除：*${page.title}*`)
    return
  }

  // /allow <用戶ID> [備註] — 加入白名單
  if (cmd === "/allow") {
    const targetId = parseInt(args[0])
    if (isNaN(targetId)) {
      await sendMessage(env, chatId, "用法：`/allow <Telegram用戶ID> [備註]`")
      return
    }
    const note = args.slice(1).join(" ") || null
    await addAllowedUser(env, targetId, userId, note ?? undefined)
    await sendMessage(env, chatId, `✅ 已將 \`${targetId}\` 加入白名單${note ? `（${note}）` : ""}。`)
    return
  }

  // /deny <用戶ID> — 移出白名單
  if (cmd === "/deny") {
    const targetId = parseInt(args[0])
    if (isNaN(targetId)) {
      await sendMessage(env, chatId, "用法：`/deny <Telegram用戶ID>`")
      return
    }
    await removeAllowedUser(env, targetId)
    await sendMessage(env, chatId, `🚫 已將 \`${targetId}\` 移出白名單。`)
    return
  }

  // /users — 查看白名單
  if (cmd === "/users") {
    const users = await listAllowedUsers(env)
    if (users.length === 0) {
      await sendMessage(env, chatId, `📋 白名單為空。\n\n目前模式：${env.BOT_ACCESS === "private" ? "🔒 私人" : "🌐 公開"}`)
      return
    }
    const lines = users.map(u => `• \`${u.user_id}\`${u.note ? ` — ${u.note}` : ""}`)
    await sendMessage(env, chatId, `📋 *白名單用戶*（模式：${env.BOT_ACCESS === "private" ? "🔒 私人" : "🌐 公開"}）\n\n${lines.join("\n")}`)
    return
  }
}

// 從 Telegram 伺服器下載檔案
async function downloadTelegramFile(env: Env, fileId: string): Promise<ArrayBuffer> {
  const infoRes = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`)
  const info = await infoRes.json<{ result: { file_path: string } }>()
  const filePath = info.result.file_path

  const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`)
  if (!fileRes.ok) throw new Error("無法下載 Telegram 檔案")
  return fileRes.arrayBuffer()
}
