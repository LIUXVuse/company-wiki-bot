export function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>知識庫管理</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 40px; width: 360px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h1 { font-size: 22px; margin-bottom: 8px; color: #1a1a1a; }
    p { font-size: 14px; color: #888; margin-bottom: 28px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #444; margin-bottom: 6px; }
    input[type=password] { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; }
    input[type=password]:focus { border-color: #4f46e5; }
    button { width: 100%; padding: 11px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; margin-top: 16px; transition: background 0.2s; }
    button:hover { background: #4338ca; }
    .error { color: #dc2626; font-size: 13px; margin-top: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📚 知識庫管理</h1>
    <p>請輸入管理員金鑰登入</p>
    <form method="POST" action="/admin/login">
      <label for="secret">管理員金鑰</label>
      <input type="password" id="secret" name="secret" placeholder="輸入 INGEST_SECRET" required autofocus>
      <button type="submit">登入</button>
      ${error ? `<div class="error">❌ ${error}</div>` : ""}
    </form>
  </div>
</body>
</html>`
}

export function dashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>知識庫管理</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; }
    header { background: #4f46e5; color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    header h1 { font-size: 18px; font-weight: 700; }
    header a { color: rgba(255,255,255,0.8); font-size: 13px; text-decoration: none; }
    header a:hover { color: white; }
    .container { max-width: 1000px; margin: 0 auto; padding: 24px 16px; }
    /* 上傳區 */
    .upload-box { background: white; border-radius: 10px; padding: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .upload-drop { border: 2px dashed #ddd; border-radius: 10px; padding: 40px 20px; text-align: center; cursor: pointer; transition: border-color 0.2s; margin-bottom: 16px; }
    .upload-drop:hover, .upload-drop.drag-over { border-color: #4f46e5; background: #f5f3ff; }
    .upload-drop p { color: #888; font-size: 14px; margin-top: 8px; }
    .upload-drop strong { color: #4f46e5; }
    #upload-file-input { display: none; }
    .upload-btn { padding: 10px 24px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; width: auto; margin-top: 0; }
    .upload-btn:hover { background: #4338ca; }
    .upload-btn:disabled { background: #a5b4fc; cursor: not-allowed; }
    .upload-status { margin-top: 16px; padding: 16px; background: #f9f9f9; border-radius: 8px; display: none; }
    .upload-status.show { display: block; }
    .status-processing { color: #666; }
    .status-success { color: #16a34a; }
    .status-error { color: #dc2626; }
    .status-titles { margin-top: 8px; font-size: 13px; color: #444; }
    .status-titles li { margin-top: 4px; }
    .format-hint { font-size: 12px; color: #999; margin-top: 12px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
    .tab { padding: 8px 18px; border-radius: 8px; border: 1px solid #ddd; background: white; cursor: pointer; font-size: 14px; transition: all 0.15s; }
    .tab.active { background: #4f46e5; color: white; border-color: #4f46e5; }
    .tab:hover:not(.active) { border-color: #4f46e5; color: #4f46e5; }
    .section { display: none; }
    .section.active { display: block; }

    /* 頁面列表 */
    .filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .filter-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid #ddd; background: white; cursor: pointer; font-size: 13px; }
    .filter-btn.active { background: #4f46e5; color: white; border-color: #4f46e5; }
    .search-input { padding: 7px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; flex: 1; min-width: 180px; outline: none; }
    .search-input:focus { border-color: #4f46e5; }
    .stat { font-size: 13px; color: #888; }

    table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    th { background: #f9f9f9; font-size: 12px; font-weight: 600; color: #666; padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; }
    td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid #f3f3f3; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafafa; }
    .badge { display: inline-block; padding: 2px 9px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #e0e7ff; color: #4f46e5; }
    .title-cell { max-width: 280px; }
    .title-cell strong { display: block; }
    .title-cell small { color: #999; font-size: 11px; }
    .summary-cell { max-width: 320px; color: #555; font-size: 12px; line-height: 1.5; }
    .del-btn { padding: 5px 12px; background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; white-space: nowrap; }
    .del-btn:hover { background: #fecaca; }
    .loading { text-align: center; padding: 48px; color: #999; }
    .empty { text-align: center; padding: 48px; color: #bbb; }

    /* 分類設定 */
    .cat-grid { display: grid; gap: 12px; }
    .cat-card { background: white; border-radius: 10px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); display: flex; align-items: flex-start; gap: 16px; }
    .cat-key { font-family: monospace; font-size: 13px; background: #f3f4f6; padding: 4px 10px; border-radius: 6px; color: #374151; white-space: nowrap; }
    .cat-info h3 { font-size: 15px; margin-bottom: 4px; }
    .cat-info p { font-size: 13px; color: #666; line-height: 1.5; }
    .cat-info .count { font-size: 12px; color: #4f46e5; margin-top: 4px; }

    /* Toast */
    #toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(80px); background: #1a1a1a; color: white; padding: 10px 20px; border-radius: 8px; font-size: 14px; opacity: 0; transition: all 0.3s; pointer-events: none; z-index: 999; }
    #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    #toast.success { background: #16a34a; }
    #toast.error { background: #dc2626; }

    /* 確認對話框 */
    .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; align-items: center; justify-content: center; }
    .overlay.open { display: flex; }
    .dialog { background: white; border-radius: 12px; padding: 28px; width: 360px; }
    .dialog h3 { font-size: 16px; margin-bottom: 8px; }
    .dialog p { font-size: 13px; color: #666; margin-bottom: 20px; line-height: 1.5; }
    .dialog-btns { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-cancel { padding: 8px 18px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .btn-confirm { padding: 8px 18px; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <h1>📚 知識庫管理</h1>
    <a href="/admin/logout">登出</a>
  </header>

  <div class="container">
    <div class="tabs">
      <button class="tab active" onclick="switchTab('pages')">📄 知識頁面</button>
      <button class="tab" onclick="switchTab('categories')">🏷️ 分類設定</button>
      <button class="tab" onclick="switchTab('upload')">📤 上傳文件</button>
    </div>

    <!-- 知識頁面 -->
    <div id="section-pages" class="section active">
      <div class="filters">
        <button class="filter-btn active" data-cat="" onclick="setCategory(this, '')">全部</button>
        <input class="search-input" type="text" id="search-input" placeholder="搜尋標題或來源檔案..." oninput="filterPages()">
        <span class="stat" id="page-stat"></span>
      </div>
      <div id="pages-table-wrap">
        <div class="loading">載入中...</div>
      </div>
    </div>

    <!-- 上傳文件 -->
    <div id="section-upload" class="section">
      <div class="upload-box">
        <div class="upload-drop" id="upload-drop" onclick="document.getElementById('upload-file-input').click()" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleDrop(event)">
          <div style="font-size:40px">📄</div>
          <p><strong>點擊選擇</strong>或拖曳檔案到這裡</p>
          <p id="upload-filename" style="margin-top:8px;color:#4f46e5;font-size:13px"></p>
        </div>
        <input type="file" id="upload-file-input" accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.jpg,.jpeg,.png,.bmp,.txt,.md" onchange="onFileSelected(this)">
        <button class="upload-btn" id="upload-btn" onclick="startUpload()" disabled>開始上傳</button>
        <div class="format-hint">支援格式：PDF、Word（docx）、PowerPoint（pptx）、Excel（xlsx）、圖片（jpg/png）、純文字（txt/md）</div>
        <div class="upload-status" id="upload-status"></div>
      </div>
    </div>

    <!-- 分類設定 -->
    <div id="section-categories" class="section">
      <div id="cat-grid-wrap">
        <div class="loading">載入中...</div>
      </div>
    </div>
  </div>

  <!-- 確認對話框 -->
  <div class="overlay" id="confirm-overlay">
    <div class="dialog">
      <h3>確認刪除</h3>
      <p id="confirm-msg"></p>
      <div class="dialog-btns">
        <button class="btn-cancel" onclick="closeConfirm()">取消</button>
        <button class="btn-confirm" id="confirm-ok">確認刪除</button>
      </div>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    let allPages = []
    let pageCounts = {}
    let currentCat = ''

    // ── Tab 切換 ──
    function switchTab(tab) {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      document.getElementById('section-' + tab).classList.add('active')
      event.target.classList.add('active')
      if (tab === 'categories' && allPages.length > 0) renderCategories()
    }

    // ── 頁面列表 ──
    async function loadPages() {
      const res = await fetch('/admin/api/pages')
      if (!res.ok) { document.getElementById('pages-table-wrap').innerHTML = '<div class="empty">載入失敗</div>'; return }
      allPages = await res.json()

      // 建立分類計數
      pageCounts = {}
      allPages.forEach(p => { pageCounts[p.category] = (pageCounts[p.category] || 0) + 1 })

      // 動態生成分類按鈕
      loadCategoryButtons()
      filterPages()
    }

    async function loadCategoryButtons() {
      const res = await fetch('/admin/api/categories')
      if (!res.ok) return
      const cats = await res.json()
      const container = document.querySelector('.filters')
      const allBtn = container.querySelector('[data-cat=""]')

      // 移除舊的分類按鈕（保留全部 + 搜尋）
      container.querySelectorAll('[data-cat]:not([data-cat=""])').forEach(b => b.remove())

      cats.forEach(cat => {
        const btn = document.createElement('button')
        btn.className = 'filter-btn'
        btn.dataset.cat = cat.key
        const count = pageCounts[cat.key] || 0
        btn.textContent = cat.name + (count ? ' ' + count : '')
        btn.onclick = function() { setCategory(this, cat.key) }
        allBtn.insertAdjacentElement('afterend', btn)
      })
    }

    function setCategory(btn, cat) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentCat = cat
      filterPages()
    }

    function filterPages() {
      const q = document.getElementById('search-input').value.toLowerCase()
      const filtered = allPages.filter(p => {
        const matchCat = !currentCat || p.category === currentCat
        const matchSearch = !q || p.title.toLowerCase().includes(q) || (p.source_file || '').toLowerCase().includes(q)
        return matchCat && matchSearch
      })
      document.getElementById('page-stat').textContent = filtered.length + ' / ' + allPages.length + ' 頁'
      renderTable(filtered)
    }

    function renderTable(pages) {
      if (pages.length === 0) {
        document.getElementById('pages-table-wrap').innerHTML = '<div class="empty">沒有符合的頁面</div>'
        return
      }
      const rows = pages.map(p => {
        const date = new Date(p.updated_at).toLocaleDateString('zh-TW')
        const summary = (p.summary || '').slice(0, 80) + ((p.summary || '').length > 80 ? '...' : '')
        return \`<tr>
          <td class="title-cell">
            <strong>\${esc(p.title)}</strong>
            <small>\${esc(p.source_file || '')}</small>
          </td>
          <td><span class="badge">\${esc(p.category)}</span></td>
          <td class="summary-cell">\${esc(summary)}</td>
          <td>\${date}</td>
          <td><button class="del-btn" onclick="confirmDelete('\${p.id}', '\${esc(p.title)}')">刪除</button></td>
        </tr>\`
      }).join('')

      document.getElementById('pages-table-wrap').innerHTML = \`<table>
        <thead><tr>
          <th>標題 / 來源</th>
          <th>分類</th>
          <th>摘要</th>
          <th>更新日期</th>
          <th></th>
        </tr></thead>
        <tbody>\${rows}</tbody>
      </table>\`
    }

    // ── 分類設定 ──
    async function renderCategories() {
      const res = await fetch('/admin/api/categories')
      if (!res.ok) { document.getElementById('cat-grid-wrap').innerHTML = '<div class="empty">載入失敗</div>'; return }
      const cats = await res.json()

      const cards = cats.map(cat => {
        const count = pageCounts[cat.key] || 0
        return \`<div class="cat-card">
          <div class="cat-key">\${esc(cat.key)}</div>
          <div class="cat-info">
            <h3>\${esc(cat.name)}</h3>
            <p>\${esc(cat.desc)}</p>
            <div class="count">目前 \${count} 個頁面</div>
          </div>
        </div>\`
      }).join('')

      document.getElementById('cat-grid-wrap').innerHTML = \`
        <div class="cat-grid">\${cards}</div>
        <p style="margin-top:16px;font-size:13px;color:#999;">修改分類請至 <code>wrangler.toml</code> → <code>WIKI_CATEGORIES</code>，改完重新 deploy。</p>
      \`
    }

    // ── 刪除 ──
    let pendingDeleteId = null

    function confirmDelete(id, title) {
      pendingDeleteId = id
      document.getElementById('confirm-msg').textContent = '確定要刪除「' + title + '」嗎？此操作無法復原。'
      document.getElementById('confirm-overlay').classList.add('open')
      document.getElementById('confirm-ok').onclick = doDelete
    }

    function closeConfirm() {
      document.getElementById('confirm-overlay').classList.remove('open')
      pendingDeleteId = null
    }

    async function doDelete() {
      const id = pendingDeleteId
      closeConfirm()
      if (!id) return

      const res = await fetch('/admin/api/pages/' + id, { method: 'DELETE' })
      if (res.ok) {
        allPages = allPages.filter(p => p.id !== id)
        filterPages()
        showToast('✅ 已刪除', 'success')
      } else {
        const err = await res.json().catch(() => ({}))
        showToast('❌ 刪除失敗：' + (err.error || res.status), 'error')
      }
    }

    // ── Toast ──
    let toastTimer = null
    function showToast(msg, type = '') {
      const el = document.getElementById('toast')
      el.textContent = msg
      el.className = 'show ' + type
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { el.className = '' }, 3000)
    }

    // ── 工具 ──
    function esc(str) {
      return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    }

    // ── 上傳文件 ──
    let selectedFile = null
    let pollTimer = null
    let pollSeconds = 0

    function onFileSelected(input) {
      selectedFile = input.files[0] || null
      document.getElementById('upload-filename').textContent = selectedFile ? selectedFile.name : ''
      document.getElementById('upload-btn').disabled = !selectedFile
      document.getElementById('upload-status').className = 'upload-status'
    }

    function handleDrop(event) {
      event.preventDefault()
      document.getElementById('upload-drop').classList.remove('drag-over')
      const file = event.dataTransfer.files[0]
      if (!file) return
      selectedFile = file
      document.getElementById('upload-filename').textContent = file.name
      document.getElementById('upload-btn').disabled = false
      document.getElementById('upload-status').className = 'upload-status'
    }

    function setStatus(html, type) {
      const el = document.getElementById('upload-status')
      el.className = 'upload-status show'
      el.innerHTML = '<div class="status-' + type + '">' + html + '</div>'
    }

    async function startUpload() {
      if (!selectedFile) return
      const btn = document.getElementById('upload-btn')
      btn.disabled = true
      pollSeconds = 0
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }

      const ext = selectedFile.name.split('.').pop().toLowerCase()
      const isText = ext === 'txt' || ext === 'md'

      try {
        if (isText) {
          setStatus('AI 分析中...', 'processing')
          const content = await selectedFile.text()
          const res = await fetch('/admin/api/upload/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: selectedFile.name, content })
          })
          const data = await res.json()
          if (data.ok) showUploadSuccess(data.pages, data.titles)
          else setStatus('❌ ' + esc(data.error || '未知錯誤'), 'error')
        } else {
          setStatus('上傳中...', 'processing')
          const formData = new FormData()
          formData.append('file', selectedFile)
          const res = await fetch('/admin/api/upload', { method: 'POST', body: formData })
          const data = await res.json()
          if (!res.ok || !data.ok) { setStatus('❌ ' + esc(data.error || '上傳失敗'), 'error'); btn.disabled = false; return }
          pollUpload(data.task_id)
        }
      } catch (err) {
        setStatus('❌ 網路錯誤：' + esc(String(err)), 'error')
        btn.disabled = false
      }
    }

    function pollUpload(taskId) {
      pollSeconds += 5
      setStatus('MinerU 轉換中，請稍候...（已等待 ' + pollSeconds + ' 秒）', 'processing')
      pollTimer = setTimeout(async () => {
        try {
          const res = await fetch('/admin/api/upload/status/' + taskId)
          const data = await res.json()
          if (data.status === 'done') {
            showUploadSuccess(data.pages, data.titles)
            loadPages()
          } else if (data.status === 'error') {
            setStatus('❌ ' + esc(data.error || '處理失敗'), 'error')
            document.getElementById('upload-btn').disabled = false
          } else {
            pollUpload(taskId)
          }
        } catch (err) {
          setStatus('❌ 網路錯誤：' + esc(String(err)), 'error')
          document.getElementById('upload-btn').disabled = false
        }
      }, 5000)
    }

    function showUploadSuccess(pages, titles) {
      const titleList = (titles || []).map(t => '<li>・' + esc(t) + '</li>').join('')
      setStatus(
        '✅ 成功！新增 ' + pages + ' 個頁面' +
        (titleList ? '<ul class="status-titles">' + titleList + '</ul>' : ''),
        'success'
      )
      selectedFile = null
      document.getElementById('upload-filename').textContent = ''
      document.getElementById('upload-file-input').value = ''
      document.getElementById('upload-btn').disabled = true
    }

    loadPages()
  </script>
</body>
</html>`
}
