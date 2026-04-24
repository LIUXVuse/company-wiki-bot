import type { Env } from "../config"

export interface MinerUResult {
  markdown: string
  images: { filename: string; data: ArrayBuffer; contentType: string }[]
}

// 呼叫 MinerU 輕量 API（免費，不需 token，限 10MB/20頁）
export async function convertWithMinerU(env: Env, fileData: ArrayBuffer, filename: string): Promise<MinerUResult> {
  const useApi = env.MINERU_USE_API === "true"
  if (!useApi) {
    throw new Error("本地 MinerU 模式：請在本機執行 ingest 腳本，不支援 Worker 直接呼叫")
  }

  const hasToken = env.MINERU_API_TOKEN && env.MINERU_API_TOKEN.length > 0

  if (hasToken) {
    return convertPrecision(env, fileData, filename)
  } else {
    return convertLightweight(fileData, filename)
  }
}

// 輕量版（免費，無需登入）
async function convertLightweight(fileData: ArrayBuffer, filename: string): Promise<MinerUResult> {
  // Step 1：上傳取得簽名 URL
  const uploadRes = await fetch("https://mineru.net/api/v1/agent/parse/file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  })

  if (!uploadRes.ok) {
    throw new Error(`MinerU 上傳失敗：${uploadRes.status}`)
  }

  const { data } = await uploadRes.json<{ data: { upload_url: string; task_id: string } }>()

  // Step 2：PUT 實際檔案
  await fetch(data.upload_url, {
    method: "PUT",
    body: fileData,
  })

  // Step 3：輪詢結果（最多等 60 秒）
  const markdown = await pollMinerUResult(data.task_id, null)
  return { markdown, images: [] } // 輕量版不回傳圖片
}

// 精準版（需 token）
async function convertPrecision(env: Env, fileData: ArrayBuffer, filename: string): Promise<MinerUResult> {
  const formData = new FormData()
  formData.append("file", new Blob([fileData]), filename)
  formData.append("parse_method", "auto")
  formData.append("return_content_list", "true")

  const res = await fetch("https://mineru.net/api/v4/extract/task", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.MINERU_API_TOKEN}` },
    body: formData,
  })

  if (!res.ok) throw new Error(`MinerU 精準版失敗：${res.status}`)

  const { data } = await res.json<{ data: { task_id: string } }>()
  const markdown = await pollMinerUResult(data.task_id, env.MINERU_API_TOKEN)
  return { markdown, images: [] }
}

// 輪詢任務結果
async function pollMinerUResult(taskId: string, token: string | null, maxWait = 60000): Promise<string> {
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  const apiBase = token
    ? `https://mineru.net/api/v4/extract/task/${taskId}`
    : `https://mineru.net/api/v1/agent/parse/${taskId}`

  const start = Date.now()
  while (Date.now() - start < maxWait) {
    await sleep(3000)

    const res = await fetch(apiBase, { headers })
    if (!res.ok) continue

    const body = await res.json<{ data: { state: string; result?: { markdown?: string; content?: string } } }>()
    const state = body.data?.state

    if (state === "done" || state === "success") {
      const md = body.data?.result?.markdown ?? body.data?.result?.content ?? ""
      if (!md) throw new Error("MinerU 回傳空內容")
      return md
    }

    if (state === "failed" || state === "error") {
      throw new Error(`MinerU 處理失敗：任務 ${taskId}`)
    }
    // state === "processing"，繼續等
  }

  throw new Error("MinerU 逾時（超過 60 秒）")
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
