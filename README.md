# Company Wiki Bot

公司知識庫 + Telegram Bot 模板。
基於 Karpathy 的 LLM Wiki 概念，不使用向量資料庫，純 Markdown 知識頁面。

## 架構

```
文件（PDF/Word/Excel/圖片等）
   ↓ 本機腳本 scripts/ingest_pdfs.py
MinerU API（PDF → Markdown）
   ↓
/ingest 接口
   ↓
LLM 自動分類 + 整理 → Wiki 頁面（.md 存 R2 + D1 索引）

Telegram 用戶問問題 → LLM 看摘要選頁 → 讀內容 → 回答
管理員 → Web 管理介面（/admin）瀏覽、刪除、查看分類
```

- **Cloudflare Workers** — Bot 邏輯 + /ingest 接口 + /admin 管理介面
- **Cloudflare R2** — 存 Markdown 知識頁面
- **Cloudflare D1** — 存索引（標題、分類、摘要）
- **MinerU API** — 文件 → Markdown
- **LLM** — 可換（DeepSeek / NVIDIA / opencode / Ollama）

---

## Fork 後的設定步驟

### 1. 安裝依賴

```bash
npm install
```

### 2. 建立 CF 資源

```bash
npx wrangler d1 create company-wiki-db
npx wrangler r2 bucket create company-wiki
```

把 D1 輸出的 ID 填入 `wrangler.toml` 的 `database_id`。

### 3. 初始化資料庫

```bash
npm run db:init
```

### 4. 設定 wrangler.toml

```toml
COMPANY_NAME = "你的公司名稱"

# LLM（預設 DeepSeek，可換）
LLM_PROVIDER = "deepseek"
LLM_MODEL    = "deepseek-v4-flash"
LLM_BASE_URL = "https://api.deepseek.com"

# 知識庫分類（可自訂，見下方說明）
WIKI_CATEGORIES = '[{"key":"policy","name":"政策法規","desc":"政府函文、法規"},...]'
```

### 5. 設定 Secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN   # BotFather 給的 token
npx wrangler secret put LLM_API_KEY          # LLM API key
npx wrangler secret put INGEST_SECRET        # 管理介面 + 本機腳本金鑰（自訂隨機字串）
npx wrangler secret put MINERU_API_TOKEN     # 選填，留空用免費輕量版
```

### 6. 設定管理員 ID

編輯 `src/config.ts`：

```ts
export const ADMIN_IDS: number[] = [
  123456789,  // 你的 Telegram user ID（用 /start 指令查詢）
]
```

### 7. 設定 .env（本機腳本用）

```bash
cp .env.example .env
# 編輯 .env，填入 INGEST_SECRET 和 BOT_URL
```

### 8. 部署

```bash
npx wrangler deploy
```

### 9. 設定 Telegram Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<YOUR_WORKER>.workers.dev/webhook"
```

---

## 日常使用

### Web 管理介面

開啟瀏覽器，前往：

```
https://<YOUR_WORKER>.workers.dev/admin
```

用 `INGEST_SECRET` 登入。功能：
- 📄 瀏覽所有知識頁面（按分類篩選、搜尋標題）
- 🗑️ 刪除頁面（有確認步驟）
- 🏷️ 查看分類設定與各分類頁面數量

---

### 上傳文件（本機腳本）

```bash
# 整個資料夾
python3 scripts/ingest_pdfs.py /你的文件資料夾/

# 單一檔案
python3 scripts/ingest_pdfs.py /path/to/file.pdf
```

> 需先設定環境變數：`export $(cat .env | xargs)`

**支援格式：**

| 格式 | 說明 |
|------|------|
| `.pdf` | PDF 文件 |
| `.docx` `.doc` | Word 文件 |
| `.pptx` `.ppt` | PowerPoint 簡報 |
| `.xlsx` `.xls` | Excel 試算表 |
| `.jpg` `.jpeg` `.png` `.bmp` | 圖片（OCR 辨識） |
| `.txt` `.md` | 純文字（不經 MinerU） |

> **注意**：同一個檔案重新上傳時，系統會**自動刪除舊版**再建新版，不需要手動 /delete。

**上傳失敗排查：**

| 錯誤訊息 | 原因 | 處理方式 |
|---------|------|---------|
| `The read operation timed out` | 檔案太大，LLM 處理超過 120 秒 | 重跑一次 |
| `INGEST_SECRET 未設定` | .env 沒有載入 | `export $(cat .env \| xargs)` |
| `MinerU 處理失敗` | 超過 10MB 或 20 頁 | 申請 MinerU API token |
| `MinerU 逾時` | MinerU 伺服器忙 | 等幾分鐘重跑 |

---

### Telegram 管理員指令

| 指令 | 說明 |
|------|------|
| `/list` | 列出所有知識頁面（含 ID） |
| `/delete <ID>` | 刪除指定頁面 |
| `/allow <用戶ID> [備註]` | 加入白名單 |
| `/deny <用戶ID>` | 移出白名單 |
| `/users` | 查看白名單 |

---

### 自訂知識庫分類

編輯 `wrangler.toml` 的 `WIKI_CATEGORIES`，改完執行 `npx wrangler deploy`：

```toml
WIKI_CATEGORIES = '[
  {"key":"policy",    "name":"政策法規", "desc":"政府函文、法規、公文"},
  {"key":"procedure", "name":"作業程序", "desc":"SOP、作業流程、指導原則"},
  {"key":"staff",     "name":"人員資格", "desc":"人員訓練、認證、資格規定"},
  {"key":"billing",   "name":"費用給付", "desc":"收費標準、給付基準、審核規定"},
  {"key":"faq",       "name":"常見問答", "desc":"常見問題與解答"}
]'
```

- `key`：內部識別碼（英文，存在資料庫）
- `name`：顯示名稱（管理介面看到的）
- `desc`：給 LLM 判斷用的說明（影響自動分類準確度）

> 改完要重新上傳所有文件，分類才會套用到舊頁面。

---

### 存取控制

`wrangler.toml` 的 `BOT_ACCESS`：

| 值 | 說明 |
|----|------|
| `"public"` | 任何人都可以問問題（預設） |
| `"private"` | 只有白名單內的用戶可以問 |

---

## LLM 切換

在 `wrangler.toml` 修改後 `npx wrangler deploy`：

| Provider | LLM_PROVIDER | LLM_MODEL | LLM_BASE_URL |
|----------|-------------|-----------|-------------|
| DeepSeek | `deepseek` | `deepseek-v4-flash` | `https://api.deepseek.com` |
| NVIDIA | `nvidia` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | `https://integrate.api.nvidia.com/v1` |
| opencode | `opencode` | `opencode/nemotron-3-super-free` | `https://api.opencode.ai/v1` |
| 本地 Ollama | `ollama` | `gemma4` | `http://192.168.1.106:11434` |
