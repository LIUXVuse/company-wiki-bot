# 系統架構說明

## 核心概念

本系統基於 [Andrej Karpathy 的 LLM Wiki 方法](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)。

**關鍵差異：不使用向量資料庫（RAG），改用純 Markdown Wiki。**

| RAG 傳統做法 | 本系統做法 |
|------------|----------|
| 文件切片 → embedding → 向量DB | 文件 → LLM 整理 → Markdown Wiki |
| 查詢時做向量相似度搜尋 | 查詢時 LLM 看摘要選頁再回答 |
| 黑盒子，人看不懂 | 純文字檔，人直接打開可讀 |

---

## 角色說明

### 管理員
- 只有在 `src/config.ts` 的 `ADMIN_IDS` 名單內的 Telegram 帳號
- 透過**本機腳本**（`upload.sh`）上傳文件（免費版 CF Workers 有 30 秒限制，無法直接從 Telegram 上傳 PDF）
- 可用 `/list`、`/delete`、`/allow`、`/deny`、`/users` 管理知識庫

### 一般用戶
- 直接傳文字訊息問問題
- Bot 會從 Wiki 裡找資料回答
- 不能上傳文件

---

## 上傳文件流程（本機腳本）

```
管理員執行 ./upload.sh /pdf資料夾/
    ↓
① Python 腳本讀取 PDF

② 呼叫 MinerU API（本機，不受 CF 30 秒限制）
   • 上傳 PDF → 取得任務 ID
   • 輪詢結果（最多等 5 分鐘）
   • 下載轉換好的 Markdown

③ POST 到 Bot 的 /ingest 接口
   （帶 X-Ingest-Secret header 驗證身份）

④ Bot 呼叫 LLM 分析 Markdown：
   • 自動判斷分類（products / iso / legal / faq）
   • 產生結構化知識頁面（繁體中文）
   • 一份文件可拆成多個頁面

⑤ 知識頁面（.md）存到 R2
   路徑格式：wiki/{category}/{slug}.md

⑥ 更新 D1 索引（標題、分類、摘要、來源）

⑦ 腳本印出結果：
   ✅ 成功！新增 2 個頁面：
     • 居家照顧服務員轉場工時紀錄指導原則
     • 衛生福利部函：BA13 陪同外出疑義
```

---

## 用戶問問題時發生的事

```
用戶傳訊息：「BA13 可以搭計程車嗎？」
    ↓
① 從 D1 取得所有頁面的標題 + 摘要清單

② LLM 看清單，挑出最相關的頁面（最多 3 頁）

③ 從 R2 讀取選出頁面的完整內容

④ LLM 收到：
   • 系統提示（你是 XX 公司 AI 助理，繁體中文回覆）
   • Wiki 內容（參考資料）
   • 用戶問題

⑤ LLM 根據 Wiki 內容組出答案
   （有交叉引用會追蹤，不亂編）

⑥ Bot 回覆用戶
```

---

## 技術架構

```
┌──────────────────────────────────────────────────┐
│               Cloudflare Workers                  │
│                                                  │
│  src/index.ts     ← Webhook 入口 + /ingest 接口   │
│  src/bot/         ← 訊息處理邏輯                  │
│  src/ingest/      ← 文件轉換與 Wiki 生成           │
│  src/storage/     ← R2 & D1 操作                  │
└──────────┬───────────────────┬────────────────────┘
           │                   │
    ┌──────▼──────┐    ┌───────▼──────┐
    │  R2 Bucket  │    │  D1 Database │
    │             │    │              │
    │ raw/        │    │ wiki_pages   │
    │ wiki/       │    │ source_files │
    └─────────────┘    │ allowed_users│
                       └──────────────┘

本機腳本（scripts/ingest_pdfs.py）
    → MinerU API（PDF → Markdown）
    → /ingest HTTP 接口（Markdown → Wiki）
```

### 外部服務

| 服務 | 用途 | 費用 |
|------|------|------|
| MinerU API | PDF → Markdown | 免費（10MB/20頁以內） |
| DeepSeek V4 Flash | LLM 推理 | 免費額度 |
| Telegram Bot API | 訊息收發 | 免費 |
| Cloudflare Workers | 執行環境 | 免費（10萬次/天） |
| Cloudflare R2 | 檔案儲存 | 免費（10GB） |
| Cloudflare D1 | 索引資料庫 | 免費（500MB） |

---

## Fork 給其他公司的修改清單

Fork 之後**必須改**的：

1. `wrangler.toml` → `COMPANY_NAME`
2. `src/config.ts` → `ADMIN_IDS`（填入管理員的 Telegram ID）
3. 建立自己的 CF 資源（`wrangler d1 create`、`wrangler r2 bucket create`）
4. 設定 secrets（`TELEGRAM_BOT_TOKEN`、`LLM_API_KEY`、`INGEST_SECRET`）
5. `.env` → 填入 `INGEST_SECRET`、`BOT_URL`

**選擇性修改**：

- `wrangler.toml` → `LLM_PROVIDER` / `LLM_MODEL`（換模型）
- `src/config.ts` → `CATEGORIES`（調整知識分類）
- `wrangler.toml` → `BOT_ACCESS`（`public` 或 `private` 白名單模式）
