import type { Env } from "../config"

export interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

// LLM 請求超時（25 秒，保留 5 秒給前後處理）
const LLM_TIMEOUT_MS = 25000

// 統一 LLM 呼叫介面
// 支援：kimi | nvidia | opencode | ollama
export async function callLLM(env: Env, messages: Message[]): Promise<string> {
  const provider = env.LLM_PROVIDER

  if (provider === "ollama") {
    return callOllama(env, messages)
  }

  // kimi / nvidia / opencode 全部走 OpenAI-compatible API
  return callOpenAICompatible(env, messages)
}

async function callOpenAICompatible(env: Env, messages: Message[]): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const res = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))

  if (!res.ok) throw new Error(`LLM 超時或未回應，請換較快的模型，或稍後再試`)


  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM API 失敗 (${res.status}): ${err}`)
  }

  const data = await res.json<{ choices: { message: { content: string } }[] }>()
  return data.choices[0].message.content.trim()
}

async function callOllama(env: Env, messages: Message[]): Promise<string> {
  // 本地 Ollama（開發用）
  const ollamaUrl = "http://192.168.1.106:11434/api/chat"
  const res = await fetch(ollamaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.LLM_MODEL || "gemma4",
      messages,
      stream: false,
    }),
  })

  if (!res.ok) throw new Error(`Ollama 失敗：${res.status}`)

  const data = await res.json<{ message: { content: string } }>()
  return data.message.content.trim()
}
