import type { Env } from "../config"
import { getCategories } from "../config"
import { listAllPages, deleteWikiPage } from "../storage/d1"
import { loginPage, dashboardPage } from "./html"

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

      // 非同步刪除 R2（不擋 response）
      env.BUCKET.delete(page.r2_key).catch(() => {})

      return Response.json({ ok: true, deleted: page.title })
    }

    // GET /admin/api/categories
    if (pathname === "/admin/api/categories" && method === "GET") {
      const cats = getCategories(env)
      return Response.json(cats)
    }

    return Response.json({ error: "Not Found" }, { status: 404 })
  }

  return new Response("Not Found", { status: 404 })
}
