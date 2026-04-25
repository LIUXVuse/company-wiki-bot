import type { Env } from "./config"
import { handleUpdate } from "./bot/handler"
import { processMarkdownToWiki } from "./ingest/wiki"
import { handleAdmin } from "./admin/handler"

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Telegram Webhook 入口
    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        const update = await request.json()
        ctx.waitUntil(handleUpdate(env, update))
        return new Response("OK")
      } catch {
        return new Response("Bad Request", { status: 400 })
      }
    }

    // 本機腳本上傳 Markdown 入口（繞過 MinerU，直接進 LLM + 知識庫）
    if (request.method === "POST" && url.pathname === "/ingest") {
      const secret = request.headers.get("X-Ingest-Secret")
      if (!env.INGEST_SECRET || secret !== env.INGEST_SECRET) {
        return new Response("Unauthorized", { status: 401 })
      }
      try {
        const { filename, markdown } = await request.json<{ filename: string; markdown: string }>()
        if (!filename || !markdown) return Response.json({ ok: false, error: "缺少 filename 或 markdown" }, { status: 400 })
        const pages = await processMarkdownToWiki(env, markdown, filename)
        return Response.json({ ok: true, pages: pages.length, titles: pages.map(p => p.title) })
      } catch (err) {
        return Response.json({ ok: false, error: String(err) }, { status: 500 })
      }
    }

    // Web 管理介面
    if (url.pathname.startsWith("/admin")) {
      return handleAdmin(request, env, url.pathname)
    }

    // 健康檢查
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", company: env.COMPANY_NAME })
    }

    return new Response("Not Found", { status: 404 })
  },
}
