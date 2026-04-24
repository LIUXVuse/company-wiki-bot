# 系統架構說明

## 核心概念

本系統基於 [Andrej Karpathy 的 LLM Wiki 方法](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)。

**關鍵差異：不使用向量資料庫（RAG），改用純 Markdown Wiki。**

| RAG 傳統做法 | 本系統做法 |
|------------|----------|
| 文件切片 → embedding → 向量DB | 文件 → LLM 整理 → Markdown Wiki |
| 查詢時做向量相似度搜尋 | 查詢時 LLM 直接讀 Wiki 頁面 |
| 黑盒子，人看不懂 | 純文字檔，人直接打開可讀 |

---

## 角色說明

### 管理員
- 只有在 `src/config.ts` 的 `ADMIN_IDS` 名單內的 Telegram 帳號
- 可以傳檔案給 Bot（PDF、Word、TXT 等）
- Bot 收到後自動處理，不需要手動操作

### 一般用戶
- 任何人都可以傳文字訊息問問題
- Bot 會從 Wiki 裡找資料回答
- 不能上傳文件

---

## 上傳文件後自動發生的事

```
管理員傳 PDF 給 Bot
    ↓
① Bot 從 Telegram 下載檔案

② 備份原始檔到 R2（raw/檔名）

③ 呼叫 MinerU API
   • 檔案 < 10MB → 免費輕量版（不需 token）
   • 檔案 > 10MB → 需要 MINERU_API_TOKEN

④ MinerU 回傳 Markdown 文字

⑤ LLM 分析內容，自動判斷：
   • 這是什麼分類？
     - products（產品說明書、同意書）
     - iso（ISO 文件、作業程序）
     - legal（政府函文、法規）
     - faq（常見問答）
   • 要拆成幾個 Wiki 頁面？
   • 每頁的標題和摘要是什麼？

⑥ 產生的 Wiki 頁面（.md）存到 R2
   路徑格式：wiki/{category}/{title}.md

⑦ 更新 D1 索引（標題、分類、摘要、來源）

⑧ Bot 回覆管理員：
   「✅ 處理完成！新增了 3 個知識頁面：
    • [iso] 防火設備維護規範
    • [legal] 環保局公文 2024-03
    • [faq] 常見維護問題」
```

---

## 用戶問問題時發生的事

```
用戶傳訊息：「消防設備多久要檢查一次？」
    ↓
① Bot 用關鍵字搜尋 D1 索引
   找到相關的 Wiki 頁面（最多 5 頁）

② 從 R2 讀取這些頁面的完整內容

③ LLM 收到：
   • 系統提示（你是 XX 公司客服助理）
   • Wiki 內容（參考資料）
   • 用戶問題

④ LLM 根據 Wiki 內容組出答案
   （只能用 Wiki 裡有的資訊，不能亂編）

⑤ Bot 回覆用戶

⑥ 如果相關頁面有附圖，一併發送圖片
```

---

## 技術架構

```
┌─────────────────────────────────────────────┐
│              Cloudflare Workers              │
│                                             │
│  src/index.ts        ← Webhook 入口         │
│  src/bot/            ← 訊息處理邏輯          │
│  src/ingest/         ← 文件轉換與 Wiki 生成  │
│  src/storage/        ← R2 & D1 操作          │
└──────────┬──────────────────┬───────────────┘
           │                  │
    ┌──────▼──────┐   ┌───────▼──────┐
    │  R2 Bucket  │   │  D1 Database │
    │             │   │              │
    │ raw/        │   │ wiki_pages   │
    │ wiki/       │   │ wiki_images  │
    │ images/     │   │ source_files │
    └─────────────┘   └──────────────┘
```

### 外部服務

| 服務 | 用途 | 費用 |
|------|------|------|
| MinerU API | PDF/Word → Markdown | 免費（10MB/20頁以內） |
| NVIDIA NIM | LLM 推理 | 免費額度 |
| Telegram Bot API | 訊息收發 | 免費 |
| Cloudflare Workers | 執行環境 | 免費（10萬次/天） |
| Cloudflare R2 | 檔案儲存 | 免費（10GB） |
| Cloudflare D1 | 索引資料庫 | 免費（500MB） |

---

## Fork 給其他公司的修改清單

Fork 之後**必須改**的：

1. `wrangler.toml` → `COMPANY_NAME`
2. `src/config.ts` → `ADMIN_IDS`（填入該公司管理員的 Telegram ID）
3. 建立自己的 CF 資源（`wrangler d1 create`、`wrangler r2 bucket create`）
4. 設定 secrets（Bot token、LLM key）

**選擇性修改**：

- `wrangler.toml` → `LLM_PROVIDER` / `LLM_MODEL`（換模型）
- `src/config.ts` → `CATEGORIES`（調整知識分類）
- `src/ingest/wiki.ts` → LLM prompt（調整 Wiki 頁面的生成風格）
