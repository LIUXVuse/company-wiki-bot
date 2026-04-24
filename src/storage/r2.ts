import type { Env } from "../config"

export async function saveMarkdown(env: Env, key: string, content: string): Promise<void> {
  await env.BUCKET.put(key, content, {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
  })
}

export async function readMarkdown(env: Env, key: string): Promise<string | null> {
  const obj = await env.BUCKET.get(key)
  if (!obj) return null
  return obj.text()
}

export async function saveImage(env: Env, key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  await env.BUCKET.put(key, data, {
    httpMetadata: { contentType },
  })
}

export async function getImageBytes(env: Env, key: string): Promise<ArrayBuffer | null> {
  const obj = await env.BUCKET.get(key)
  if (!obj) return null
  return obj.arrayBuffer()
}

export async function saveRawFile(env: Env, filename: string, data: ArrayBuffer, contentType: string): Promise<string> {
  const key = `raw/${Date.now()}_${filename}`
  await env.BUCKET.put(key, data, {
    httpMetadata: { contentType },
  })
  return key
}
