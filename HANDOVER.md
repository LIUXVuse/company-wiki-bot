# HANDOVER — company-wiki-bot

## ✅ 目前完成的所有功能

### 核心系統
- **Telegram Bot**：用戶傳訊息 → LLM 從 Wiki 選頁 → 多步推理回答
- **知識庫**：Markdown 頁面存 R2，索引存 D1，LLM 自動分類
- **本機上傳腳本**：`scripts/ingest_pdfs.py`，支援 PDF/Word/PPT/Excel/圖片/文字

### Web 管理介面（`/admin`）
- 登入：用 `INGEST_SECRET` 驗證，Cookie 24 小時有效
- **📄 知識頁面**：按分類篩選、搜尋標題、checkbox 批量勾選、批量刪除
- **🏷️ 分類設定**：查看各分類 key/名稱/說明及頁面數
- **📤 上傳文件**：多選或拖曳，每個檔案獨立進度，txt/md 即時處理，PDF 非同步輪詢

### 已修正的 Bug
- `wiki.ts` prompt 範例中寫死 `"iso"` 分類 → 已改為佔位符
- 刪除確認框：`pendingDeleteId` 被提前清空 → 已修正
- `ingest_pdfs.py` 上傳逾時 30s → 改為 120s

## 🔑 API Keys 存放位置

**全部在 Cloudflare Workers Secrets（加密），不在任何本地檔案。**

| Secret 名稱 | 用途 |
|------------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot |
| `LLM_API_KEY` | DeepSeek API |
| `MINERU_API_TOKEN` | MinerU（選填，留空用免費版）|
| `INGEST_SECRET` | 管理介面登入 + 本機腳本驗證 |

本地 `.env` 也有 `INGEST_SECRET` 和 `BOT_URL`，供 `ingest_pdfs.py` 使用。

```bash
npx wrangler secret list   # 列出名稱
echo "新值" | npx wrangler secret put LLM_API_KEY
```

## 📍 目前設定

| 項目 | 值 | 位置 |
|------|-----|------|
| LLM | DeepSeek V4 Flash | `wrangler.toml` |
| 管理員 TG ID | `971784686` | `src/config.ts` |
| 公司名稱 | `我的公司` | `wrangler.toml` → `COMPANY_NAME` |
| Webhook URL | `https://company-wiki-bot.liupony2000.workers.dev/webhook` | - |
| 管理介面 | `https://company-wiki-bot.liupony2000.workers.dev/admin` | - |

## 📦 上傳新文件

### 方法 A：Web 管理介面（推薦，不需開 terminal）
前往 `/admin` → 點「📤 上傳文件」頁籤，拖曳或選取檔案。

### 方法 B：本機腳本（批量或大型檔案）
```bash
export $(cat .env | xargs)
python3 scripts/ingest_pdfs.py /你的文件資料夾/
```

**上傳失敗排查**：

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `The read operation timed out` | LLM 超過 120s | 重跑一次通常會過 |
| `INGEST_SECRET 未設定` | .env 沒載入 | `export $(cat .env \| xargs)` |
| `MinerU 處理失敗` | 超過 10MB/20 頁 | 申請 MINERU_API_TOKEN |

## 📁 專案結構

```
company-wiki-bot/
├── wrangler.toml        ← CF 設定、LLM 模型、公司名稱、分類
├── schema.sql           ← D1 資料表定義
├── .env                 ← 本地密鑰（INGEST_SECRET, BOT_URL）
├── scripts/
│   └── ingest_pdfs.py   ← 本機上傳腳本
├── src/
│   ├── index.ts         ← 路由入口（/webhook /ingest /admin /health）
│   ├── config.ts        ← Env 型別、ADMIN_IDS、分類定義
│   ├── bot/             ← Telegram 訊息處理
│   ├── ingest/          ← MinerU + LLM + Wiki 生成
│   ├── admin/           ← Web 管理介面（html.ts + handler.ts）
│   └── storage/         ← R2 & D1 操作
├── README.md
└── ARCHITECTURE.md
```

## 🔴 下一個對話要先做

目前無高優先待辦。

可考慮的方向：
- **多語言支援**：偵測用戶語言，自動切換回答語言
- **向量搜尋**：知識庫超過 80 頁後考慮加，提升搜尋品質
- **知識庫分析頁**：統計問答次數、熱門問題

## ⚠️ 已知限制

- MinerU 免費版：10MB / 20 頁。大文件需 `MINERU_API_TOKEN`
- CF Workers 免費版 CPU 限制：上傳走非同步輪詢，不受影響
- 知識庫建議 < 80 頁（LLM 摘要選頁的 token 限制）
