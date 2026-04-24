import type { Env } from "../config"
import type { TelegramMessage } from "./handler"
import { sendMessage } from "./handler"
import { convertWithMinerU } from "../ingest/mineru"
import { processMarkdownToWiki } from "../ingest/wiki"
import { saveRawFile } from "../storage/r2"
import { createSourceFile, updateSourceFileStatus } from "../storage/d1"
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
    const { markdown } = await convertWithMinerU(env, fileData, filename)

    // Step 4：LLM 整理成 wiki 頁面
    const pages = await processMarkdownToWiki(env, markdown, filename)

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

// 從 Telegram 伺服器下載檔案
async function downloadTelegramFile(env: Env, fileId: string): Promise<ArrayBuffer> {
  const infoRes = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`)
  const info = await infoRes.json<{ result: { file_path: string } }>()
  const filePath = info.result.file_path

  const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`)
  if (!fileRes.ok) throw new Error("無法下載 Telegram 檔案")
  return fileRes.arrayBuffer()
}
