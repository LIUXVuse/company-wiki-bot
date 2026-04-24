import type { Env } from "./config"
import { handleUpdate } from "./bot/handler"

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Telegram Webhook 入口
    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        const update = await request.json()
        // waitUntil 確保 Worker 不會在回傳 OK 後就被砍掉
        ctx.waitUntil(handleUpdate(env, update))
        return new Response("OK")
      } catch {
        return new Response("Bad Request", { status: 400 })
      }
    }

    // 健康檢查
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", company: env.COMPANY_NAME })
    }

    return new Response("Not Found", { status: 404 })
  },
}
