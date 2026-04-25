#!/usr/bin/env python3
"""
本機 PDF 上傳腳本
用途：把 PDF/TXT 轉成 Markdown（透過 MinerU），再送給 Bot 存入知識庫
使用方式：
  python3 scripts/ingest_pdfs.py 你的資料夾/
  python3 scripts/ingest_pdfs.py 單一檔案.pdf
"""

import sys
import os
import time
import json
import urllib.request
import urllib.error
import urllib.parse
import http.client
from pathlib import Path

# ── 設定區（只改這裡）──────────────────────────────────────────
BOT_URL    = os.environ.get("BOT_URL", "https://company-wiki-bot.liupony2000.workers.dev")
INGEST_SECRET = os.environ.get("INGEST_SECRET", "")   # 從 .env 讀取，不要直接填在這
MINERU_TOKEN  = os.environ.get("MINERU_API_TOKEN", "") # 選填，留空用免費版
# ──────────────────────────────────────────────────────────────

SUPPORTED = {
    ".pdf",              # PDF 文件
    ".docx", ".doc",     # Word 文件
    ".pptx", ".ppt",     # PowerPoint 簡報
    ".xlsx", ".xls",     # Excel 試算表
    ".txt", ".md",       # 純文字（直接讀，不過 MinerU）
    ".jpg", ".jpeg",     # 圖片（MinerU OCR）
    ".png", ".bmp",      # 圖片（MinerU OCR）
}
MINERU_POLL_INTERVAL = 5   # 每幾秒 poll 一次
MINERU_MAX_WAIT = 300      # 最多等幾秒（5分鐘）


HEADERS_BASE = {"User-Agent": "ingest-script/1.0"}

def post_json(url, data, headers=None):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", **HEADERS_BASE, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def put_bytes(url, data):
    """PUT binary data 到簽名 URL，不加 Content-Type（OSS 簽名要求）"""
    parsed = urllib.parse.urlparse(url)
    path = parsed.path + ("?" + parsed.query if parsed.query else "")
    conn = http.client.HTTPSConnection(parsed.netloc, timeout=60)
    conn.request("PUT", path, body=data, headers={})
    resp = conn.getresponse()
    conn.close()
    if resp.status not in (200, 204):
        raise urllib.error.HTTPError(url, resp.status, resp.reason, {}, None)
    return resp.status


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={**HEADERS_BASE, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def mineru_convert(file_path: Path) -> str:
    """把檔案送去 MinerU，等結果，回傳 markdown 字串"""
    suffix = file_path.suffix.lower()

    # .txt / .md 直接讀，不需要 MinerU
    if suffix in (".txt", ".md"):
        print(f"  → 文字檔，直接讀取")
        return file_path.read_text(encoding="utf-8", errors="replace")

    file_bytes = file_path.read_bytes()
    filename = file_path.name

    if MINERU_TOKEN:
        # 精準版（需 token）
        print(f"  → 使用 MinerU 精準版")
        import io
        boundary = "----FormBoundary"
        body = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode() + file_bytes + f"\r\n--{boundary}--\r\n".encode()
        req = urllib.request.Request(
            "https://mineru.net/api/v4/extract/task",
            data=body,
            headers={
                "Authorization": f"Bearer {MINERU_TOKEN}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            }
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.loads(r.read())
        task_id = resp["data"]["task_id"]
        poll_url = f"https://mineru.net/api/v4/extract/task/{task_id}"
        poll_headers = {"Authorization": f"Bearer {MINERU_TOKEN}"}
    else:
        # 免費輕量版
        print(f"  → 使用 MinerU 免費版（限 10MB / 20頁）")
        resp = post_json("https://mineru.net/api/v1/agent/parse/file", {"file_name": filename})
        upload_url = resp["data"]["file_url"]
        task_id = resp["data"]["task_id"]
        put_bytes(upload_url, file_bytes)
        poll_url = f"https://mineru.net/api/v1/agent/parse/{task_id}"
        poll_headers = {}

    # Polling
    print(f"  → 等待 MinerU 處理（task: {task_id}）", end="", flush=True)
    start = time.time()
    while time.time() - start < MINERU_MAX_WAIT:
        time.sleep(MINERU_POLL_INTERVAL)
        print(".", end="", flush=True)
        data = get_json(poll_url, poll_headers)
        state = data.get("data", {}).get("state", "")
        if state in ("done", "success"):
            print(" 完成")
            result = data["data"].get("result", {})
            md = result.get("markdown") or result.get("content") or ""
            if not md:
                md_url = data["data"].get("markdown_url", "")
                if md_url:
                    md_req = urllib.request.Request(md_url, headers=HEADERS_BASE)
                    with urllib.request.urlopen(md_req, timeout=30) as md_r:
                        md = md_r.read().decode("utf-8", errors="replace")
            if not md:
                raise RuntimeError("MinerU 回傳空內容")
            return md
        if state in ("failed", "error"):
            raise RuntimeError(f"MinerU 處理失敗（task: {task_id}）")

    raise RuntimeError(f"MinerU 逾時（超過 {MINERU_MAX_WAIT} 秒）")


def send_to_bot(filename: str, markdown: str):
    """把 markdown 送給 Bot 的 /ingest 接口"""
    if not INGEST_SECRET:
        raise RuntimeError("INGEST_SECRET 未設定，請設定環境變數或在腳本頂部填入")
    result = post_json(
        f"{BOT_URL}/ingest",
        {"filename": filename, "markdown": markdown},
        headers={"X-Ingest-Secret": INGEST_SECRET},
    )
    return result


def process_file(file_path: Path):
    print(f"\n{'='*50}")
    print(f"處理：{file_path.name}")
    if file_path.suffix.lower() not in SUPPORTED:
        print(f"  ⚠️  不支援的格式，跳過")
        return

    try:
        markdown = mineru_convert(file_path)
        print(f"  → Markdown 長度：{len(markdown)} 字元")
        print(f"  → 送給 Bot 知識庫...")
        result = send_to_bot(file_path.name, markdown)
        if result.get("ok"):
            print(f"  ✅ 成功！新增 {result['pages']} 個頁面：")
            for title in result.get("titles", []):
                print(f"     • {title}")
        else:
            print(f"  ❌ 失敗：{result.get('error')}")
    except Exception as e:
        print(f"  ❌ 錯誤：{e}")


def main():
    if len(sys.argv) < 2:
        print("用法：python3 scripts/ingest_pdfs.py <資料夾或檔案路徑>")
        sys.exit(1)

    target = Path(sys.argv[1])

    if target.is_dir():
        files = [f for f in sorted(target.iterdir()) if f.is_file() and f.suffix.lower() in SUPPORTED]
        if not files:
            print(f"資料夾 {target} 裡沒有支援的檔案（{', '.join(SUPPORTED)}）")
            sys.exit(1)
        print(f"找到 {len(files)} 個檔案，開始處理...")
        for f in files:
            process_file(f)
    elif target.is_file():
        process_file(target)
    else:
        print(f"找不到：{target}")
        sys.exit(1)

    print(f"\n{'='*50}")
    print("全部完成！用 /list 確認知識庫內容。")


if __name__ == "__main__":
    main()
