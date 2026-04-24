# Company Wiki Bot

公司知識庫 + Telegram Bot 模板。
基於 Karpathy 的 LLM Wiki 概念，不使用向量資料庫，純 Markdown 知識頁面。

## 架構

```
PDF/Word 上傳 → MinerU API → LLM 整理 → Wiki (.md 存 R2)
                                              ↑
Telegram 用戶問問題 → LLM 讀 Wiki → 回答（含圖片）
```

- **Cloudflare Workers** — Bot 邏輯
- **Cloudflare R2** — 存 Markdown 和圖片
- **Cloudflare D1** — 存索引（哪些文件、分類）
- **MinerU API** — PDF/Word → Markdown
- **LLM** — 可換（NVIDIA / opencode / Ollama）

## Fork 後的設定步驟

### 1. 安裝依賴

```bash
npm install
```

### 2. 建立 CF 資源

```bash
# 建立 D1 資料庫
npx wrangler d1 create company-wiki-db

# 建立 R2 bucket
npx wrangler r2 bucket create company-wiki
```

把輸出的 ID 填入 `wrangler.toml` 的 `database_id`。

### 3. 初始化資料庫

```bash
npm run db:init
```

### 4. 設定公司名稱和 LLM

編輯 `wrangler.toml`：

```toml
[vars]
COMPANY_NAME = "你的公司名稱"
LLM_PROVIDER = "nvidia"   # nvidia | opencode | ollama
LLM_MODEL = "nvidia/llama-3.1-nemotron-ultra-253b-v1"
LLM_BASE_URL = "https://integrate.api.nvidia.com/v1"
```

### 5. 設定 Secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN   # BotFather 給的 token
npx wrangler secret put LLM_API_KEY          # NVIDIA / opencode API key
npx wrangler secret put MINERU_API_TOKEN     # 選填，留空用免費輕量版
```

### 6. 設定管理員 ID

編輯 `src/config.ts`：

```ts
export const ADMIN_IDS: number[] = [
  123456789,  // 你的 Telegram user ID（用 /start 指令查詢）
]
```

### 7. 部署

```bash
npm run deploy
```

### 8. 設定 Telegram Webhook

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER>.workers.dev/webhook"
```

## 使用方式

### 管理員上傳文件

直接把 PDF / Word 檔傳給 Bot，Bot 會自動：
1. 呼叫 MinerU 轉成 Markdown
2. LLM 整理成知識頁面
3. 存到 R2 + 更新 D1 索引
4. 回傳新增了哪些頁面

### 用戶問問題

直接傳訊息，例如：
- 防火門的維護週期？
- ISO 9001 文件在哪裡更新？
- 產品保固是幾年？

## LLM 切換

在 `wrangler.toml` 修改：

| Provider | LLM_PROVIDER | LLM_MODEL | LLM_BASE_URL |
|----------|-------------|-----------|-------------|
| NVIDIA | `nvidia` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | `https://integrate.api.nvidia.com/v1` |
| opencode | `opencode` | `opencode/nemotron-3-super-free` | `https://api.opencode.ai/v1` |
| 本地 Ollama | `ollama` | `gemma4` | （自動用 192.168.1.106） |
