import type { Env } from "../config"
import { getCategories } from "../config"
import { listAllPages, deleteWikiPage, createUploadTask, updateUploadTask, getUploadTask } from "../storage/d1"
import { processMarkdownToWiki } from "../ingest/wiki"
import { loginPage, dashboardPage } from "./html"
import { nanoid } from "../utils"

const COOKIE_NAME = "admin_session"

function isAuthenticated(request: Request, env: Env): boolean {
  const cookie = request.headers.get("Cookie") || ""
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  return !!match && match[1] === env.INGEST_SECRET
}

function authCookie(secret: string): string {
  return `${COOKIE_NAME}=${secret}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=86400`
}

export async function handleAdmin(request: Request, env: Env, pathname: string): Promise<Response> {
  const method = request.method

  // ── 登入 ──
  if (pathname === "/admin/login" && method === "POST") {
    const body = await request.formData()
    const secret = body.get("secret")?.toString() ?? ""
    if (secret !== env.INGEST_SECRET) {
      return new Response(loginPage("金鑰錯誤，請重試"), {
        status: 401,
        headers: { "Content-Type": "text/html;charset=utf-8" },
      })
    }
    return new Response(null, {
      status: 302,
      headers: { Location: "/admin", "Set-Cookie": authCookie(env.INGEST_SECRET) },
    })
  }

  // ── 登出 ──
  if (pathname === "/admin/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/admin",
        "Set-Cookie": `${COOKIE_NAME}=; Path=/admin; HttpOnly; Max-Age=0`,
      },
    })
  }

  // ── 主頁（需登入）──
  if (pathname === "/admin" && method === "GET") {
    if (!isAuthenticated(request, env)) {
      return new Response(loginPage(), { headers: { "Content-Type": "text/html;charset=utf-8" } })
    }
    return new Response(dashboardPage(), { headers: { "Content-Type": "text/html;charset=utf-8" } })
  }

  // ── API 路由（需登入）──
  if (pathname.startsWith("/admin/api/")) {
    if (!isAuthenticated(request, env)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // GET /admin/api/pages
    if (pathname === "/admin/api/pages" && method === "GET") {
      const pages = await listAllPages(env)
      return Response.json(pages)
    }

    // DELETE /admin/api/pages/:id
    const deleteMatch = pathname.match(/^\/admin\/api\/pages\/([^/]+)$/)
    if (deleteMatch && method === "DELETE") {
      const id = deleteMatch[1]
      const page = await deleteWikiPage(env, id)
      if (!page) return Response.json({ error: "頁面不存在" }, { status: 404 })
      env.BUCKET.delete(page.r2_key).catch(() => {})
      return Response.json({ ok: true, deleted: page.title })
    }

    // GET /admin/api/categories
    if (pathname === "/admin/api/categories" && method === "GET") {
      const cats = getCategories(env)
      return Response.json(cats)
    }

    // ── 上傳文件 API ─────────────────────────────────────────

    // POST /admin/api/upload/text — 純文字檔直接處理（不需 MinerU）
    if (pathname === "/admin/api/upload/text" && method === "POST") {
      const { filename, content } = await request.json<{ filename: string; content: string }>()
      if (!filename || !content) return Response.json({ error: "缺少 filename 或 content" }, { status: 400 })
      const pages = await processMarkdownToWiki(env, content, filename)
      return Response.json({ ok: true, pages: pages.length, titles: pages.map(p => p.title) })
    }

    // POST /admin/api/upload — 二進位檔案（PDF/Word 等），送給 MinerU 非同步處理
    if (pathname === "/admin/api/upload" && method === "POST") {
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      if (!file) return Response.json({ error: "缺少 file" }, { status: 400 })

      const filename = file.name
      const fileBytes = await file.arrayBuffer()

      // 向 MinerU 取得上傳 URL + task_id
      const mineruResp = await fetch("https://mineru.net/api/v1/agent/parse/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: filename }),
      })
      if (!mineruResp.ok) {
        return Response.json({ error: "無法連接 MinerU，請稍後再試" }, { status: 502 })
      }
      const mineruData = await mineruResp.json<{ data: { file_url: string; task_id: string } }>()
      const { file_url, task_id } = mineruData.data

      // 把檔案 PUT 到 MinerU 的 OSS 簽名 URL（不帶 Content-Type）
      const putResp = await fetch(file_url, { method: "PUT", body: fileBytes })
      if (!putResp.ok) {
        return Response.json({ error: "上傳到 MinerU 失敗" }, { status: 502 })
      }

      // 記錄任務到 D1
      await createUploadTask(env, task_id, filename)

      return Response.json({ ok: true, task_id })
    }

    // GET /admin/api/upload/status/:task_id — 輪詢狀態；MinerU 完成時觸發 LLM 處理
    const statusMatch = pathname.match(/^\/admin\/api\/upload\/status\/([^/]+)$/)
    if (statusMatch && method === "GET") {
      const taskId = statusMatch[1]
      const task = await getUploadTask(env, taskId)
      if (!task) return Response.json({ error: "找不到此任務" }, { status: 404 })

      // 已處理完畢，直接回傳結果
      if (task.status === "done" || task.status === "error") {
        return Response.json({
          status: task.status,
          pages: task.pages_created,
          titles: task.page_titles ? JSON.parse(task.page_titles) : [],
          error: task.error_msg,
        })
      }

      // 向 MinerU 查詢轉換狀態
      const pollResp = await fetch(`https://mineru.net/api/v1/agent/parse/${taskId}`)
      if (!pollResp.ok) return Response.json({ status: "processing" })

      const pollData = await pollResp.json<{ data: { state: string; result?: { markdown?: string; content?: string }; markdown_url?: string } }>()
      const state = pollData.data?.state ?? ""

      if (state === "failed" || state === "error") {
        await updateUploadTask(env, taskId, "error", 0, [], "MinerU 轉換失敗")
        return Response.json({ status: "error", error: "MinerU 轉換失敗" })
      }

      if (state !== "done" && state !== "success") {
        return Response.json({ status: "processing" })
      }

      // MinerU 完成 → 取 Markdown → 呼叫 LLM
      let markdown = pollData.data.result?.markdown ?? pollData.data.result?.content ?? ""
      if (!markdown && pollData.data.markdown_url) {
        const mdResp = await fetch(pollData.data.markdown_url)
        markdown = await mdResp.text()
      }
      if (!markdown) {
        await updateUploadTask(env, taskId, "error", 0, [], "MinerU 回傳空內容")
        return Response.json({ status: "error", error: "MinerU 回傳空內容" })
      }

      try {
        const pages = await processMarkdownToWiki(env, markdown, task.filename)
        await updateUploadTask(env, taskId, "done", pages.length, pages.map(p => p.title))
        return Response.json({ status: "done", pages: pages.length, titles: pages.map(p => p.title) })
      } catch (err) {
        await updateUploadTask(env, taskId, "error", 0, [], String(err))
        return Response.json({ status: "error", error: String(err) })
      }
    }

    return Response.json({ error: "Not Found" }, { status: 404 })
  }

  return new Response("Not Found", { status: 404 })
}
