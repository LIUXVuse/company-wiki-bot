# HANDOVER — company-wiki-bot

## ✅ 本次完成

- 完整架構設計與實作（Cloudflare Workers + R2 + D1）
- Telegram Bot 上線（webhook 已設定）
- MinerU API 整合（PDF/Word → Markdown）
- LLM 整合（目前用 DeepSeek V4 Flash）
- 知識庫 Wiki 系統（文件 → LLM 整理 → Markdown 頁面）
- 管理員上傳文件自動處理流程
- 部署到 Cloudflare Workers

## 🔑 API Keys 存放位置

**全部在 Cloudflare Workers Secrets（加密），不在任何本地檔案。**

| Secret 名稱 | 用途 | 備註 |
|------------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot | 需要時去 BotFather 重新產生 |
| `LLM_API_KEY` | DeepSeek API | https://platform.deepseek.com |
| `MINERU_API_TOKEN` | MinerU（選填） | 留空 = 免費輕量版 |

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

## 🔴 下一個對話要先做

1. **測試上傳文件**：去 Telegram 傳一個 PDF，確認 MinerU → LLM → Wiki 全流程跑通
2. **改公司名稱**：`wrangler.toml` → `COMPANY_NAME` 改成真實名稱，`npx wrangler deploy`
3. **換 API key**：DeepSeek key 明文出現過在對話，建議去後台換新的再用 `wrangler secret put` 更新

## ⚠️ 已知問題 / 注意事項

- MinerU 免費輕量版限制：10MB / 20頁。超過需申請 `MINERU_API_TOKEN`
- CF Workers 免費版背景執行上限約 30 秒，複雜文件可能處理超時
- Wiki 搜尋目前是簡單關鍵字比對（D1 LIKE query），不是向量搜尋，複雜問題可能找不到相關頁面
- LLM 超時設定：55 秒（`src/ingest/llm.ts` → `LLM_TIMEOUT_MS`）

## 📁 專案結構

```
company-wiki-bot/
├── wrangler.toml        ← CF 設定、LLM 模型、公司名稱
├── schema.sql           ← D1 資料表定義
├── src/
│   ├── index.ts         ← Webhook 入口（CF Worker）
│   ├── config.ts        ← ADMIN_IDS、分類定義
│   ├── bot/
│   │   ├── handler.ts   ← Telegram 訊息路由
│   │   ├── commands.ts  ← 管理員上傳文件處理
│   │   └── query.ts     ← 用戶問答邏輯
│   ├── ingest/
│   │   ├── mineru.ts    ← PDF → Markdown
│   │   ├── llm.ts       ← LLM 統一呼叫介面
│   │   └── wiki.ts      ← Markdown → Wiki 頁面
│   └── storage/
│       ├── r2.ts        ← R2 檔案讀寫
│       └── d1.ts        ← D1 索引查詢
├── README.md            ← 部署說明
└── ARCHITECTURE.md      ← 系統架構說明
```
