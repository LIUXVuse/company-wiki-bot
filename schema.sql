-- 知識頁面索引（實際內容存在 R2）
CREATE TABLE IF NOT EXISTS wiki_pages (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,        -- products | iso | legal | faq
  r2_key      TEXT NOT NULL UNIQUE, -- R2 裡的路徑，e.g. wiki/iso/fire_safety.md
  source_file TEXT,                 -- 來源檔名
  summary     TEXT,                 -- 一行摘要，方便搜尋時快速過濾
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- 圖片索引
CREATE TABLE IF NOT EXISTS wiki_images (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  r2_key      TEXT NOT NULL UNIQUE, -- e.g. images/iso/fire_safety_fig1.png
  caption     TEXT,
  created_at  INTEGER NOT NULL
);

-- 上傳記錄
CREATE TABLE IF NOT EXISTS source_files (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  r2_key      TEXT NOT NULL,        -- raw/ 底下的備份路徑
  status      TEXT NOT NULL DEFAULT 'processing', -- processing | done | error
  error_msg   TEXT,
  pages_created INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_category ON wiki_pages(category);
CREATE INDEX IF NOT EXISTS idx_wiki_images_page_id ON wiki_images(page_id);
