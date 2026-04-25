# HANDOVER — company-wiki-bot

## ✅ 本次完成

- **本機 ingest 腳本**：`scripts/ingest_pdfs.py`，繞過 CF Workers 30 秒限制
- **Bot `/ingest` 接口**：接收本機腳本轉好的 Markdown，直接進 LLM + 知識庫
- **INGEST_SECRET**：已設定為 Cloudflare Worker secret（加密儲存）
- **MinerU API 修正**：`file_name`、`file_url`、OSS PUT 不帶 Content-Type、markdown_url 下載
- **搜尋改進**：由 LLM 看所有頁面摘要後挑選最相關頁面（取代 LIKE 關鍵字搜尋）
- **/list 修正**：方括號破壞 Markdown、底線破壞 Markdown，改為純文字輸出
- **多步推理 prompt**：要求 LLM 追蹤交叉引用條件（如「符合教保員資格者」）
- **已成功上傳 12 份文件**進知識庫，全部可正常問答

## 🔑 API Keys 存放位置

**全部在 Cloudflare Workers Secrets（加密），不在任何本地檔案。**

| Secret 名稱 | 用途 | 備註 |
|------------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot | 需要時去 BotFather 重新產生 |
| `LLM_API_KEY` | DeepSeek API | https://platform.deepseek.com |
| `MINERU_API_TOKEN` | MinerU（選填） | 留空 = 免費輕量版 |
| `INGEST_SECRET` | 本機腳本驗證用 | 見 `scripts/ingest_pdfs.py` |

讀取或更新 secrets：
```bash
npx wrangler secret list                    # 列出名稱（不顯示值）
echo "新的key" | npx wrangler secret put LLM_API_KEY   # 更新
```

## 📍 目前設定

- **LLM**：DeepSeek V4 Flash（`wrangler.toml` 可換）
- **管理員 TG ID**：`971784686`（`src/config.ts` 可加人）
- **公司名稱**：`我的公司`（`wrangler.toml` → `COMPANY_NAME`）
- **Webhook**：`https://company-wiki-bot.liupony2000.workers.dev/webhook`

## 📦 上傳新文件的方法（本機腳本）

CF Workers 有 30 秒限制，PDF 轉換需透過本機腳本：

```bash
INGEST_SECRET=<從 wrangler secret list 確認後自行填入> \
  /opt/homebrew/bin/python3 scripts/ingest_pdfs.py 你的PDF資料夾/
```

支援格式：`.pdf`、`.txt`、`.md`、`.docx`（.txt/.md 直接讀，不經 MinerU）

## 📦 Option B：升級 Cloudflare Workers 付費版（備用方案）

> 如果未來不想用本機腳本，可升級 CF Workers 付費版（$5/月），讓 Bot 直接透過 Telegram 接收 PDF。

**升級後的差異**：
- `waitUntil` 可執行最多 **15 分鐘**（免費版僅 30 秒）
- MinerU 的 polling 就不會被砍掉，Telegram 上傳即可自動處理

**升級步驟**：
1. 到 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → 升級方案
2. 升級後不需要改任何程式碼，直接 `npx wrangler deploy` 即可

---

## ✅ 本次新增功能

- **可自訂分類**：`wrangler.toml` → `WIKI_CATEGORIES`（JSON），改完 deploy 即生效
- **重複上傳自動覆蓋**：同一檔案重新上傳，自動刪舊版建新版
- **搜尋頁數上限**：摘要清單限 80 頁，防止 token 爆炸
- **更多格式支援**：docx/doc/pptx/ppt/jpg/png/bmp

## ✅ 本次新增：線上上傳文件

- **📤 上傳頁籤**：拖曳或點擊選檔，支援所有格式
- **txt/md**：即時處理，上傳後幾秒內完成
- **PDF/Word/其他**：送 MinerU 非同步轉換，每 5 秒輪詢一次，完成自動顯示結果
- **D1 新表** `upload_tasks`：追蹤每次上傳的狀態
- **API**：`POST /admin/api/upload`、`POST /admin/api/upload/text`、`GET /admin/api/upload/status/:id`

## ✅ 本次新增：Web 管理介面

- **路由**：`/admin`（純 HTML + JS，部署在同一個 CF Worker）
- **登入**：POST `/admin/login`，用 INGEST_SECRET 比對，寫 HttpOnly Cookie
- **API**：
  - `GET /admin/api/pages` — 列出所有知識頁面（JSON）
  - `DELETE /admin/api/pages/:id` — 刪除頁面（同步刪 D1，非同步刪 R2）
  - `GET /admin/api/categories` — 讀取分類設定
- **新增檔案**：`src/admin/html.ts`（頁面 HTML）、`src/admin/handler.ts`（路由邏輯）

使用網址：`https://company-wiki-bot.liupony2000.workers.dev/admin`

## 🔮 待開發（已記錄）

- **多語言支援**（日文/中文切換）：偵測用戶語言，自動切換回答語言

## ⚠️ 已知問題 / 注意事項

- MinerU 免費版限制：10MB / 20頁。超過需申請 `MINERU_API_TOKEN`
- 知識庫搜尋：LLM 先看所有頁面摘要挑選，再讀完整內容。頁面數量 < 50 頁時品質好；之後考慮向量搜尋
- LLM 超時設定：55 秒（`src/ingest/llm.ts`）
- 部署太頻繁會觸發 CF rate limit，等 2 分鐘再重試

## 📁 專案結構

```
company-wiki-bot/
├── wrangler.toml        ← CF 設定、LLM 模型、公司名稱
├── schema.sql           ← D1 資料表定義
├── scripts/
│   └── ingest_pdfs.py   ← 本機上傳腳本（PDF → MinerU → Bot）
├── src/
│   ├── index.ts         ← Webhook 入口 + /ingest HTTP 接口
│   ├── config.ts        ← ADMIN_IDS、分類定義
│   ├── bot/
│   │   ├── handler.ts   ← Telegram 訊息路由
│   │   ├── commands.ts  ← 管理員指令（/list /delete /allow /deny /users）
│   │   └── query.ts     ← 用戶問答（LLM 選頁 + 多步推理）
│   ├── ingest/
│   │   ├── mineru.ts    ← PDF → Markdown（CF Worker 版，目前不走此路）
│   │   ├── llm.ts       ← LLM 統一呼叫介面
│   │   └── wiki.ts      ← Markdown → Wiki 頁面
│   └── storage/
│       ├── r2.ts        ← R2 檔案讀寫
│       └── d1.ts        ← D1 索引查詢
├── README.md
└── ARCHITECTURE.md
```
