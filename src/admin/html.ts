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
    .container { max-width: 1000px; margin: 0 auto; padding: 24px 16px 80px; }
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
    tr.selected td { background: #f5f3ff; }
    .badge { display: inline-block; padding: 2px 9px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #e0e7ff; color: #4f46e5; }
    .title-cell { max-width: 260px; }
    .title-cell strong { display: block; }
    .title-cell small { color: #999; font-size: 11px; }
    .summary-cell { max-width: 300px; color: #555; font-size: 12px; line-height: 1.5; }
    .del-btn { padding: 5px 12px; background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; white-space: nowrap; }
    .del-btn:hover { background: #fecaca; }
    .cb-cell { width: 36px; text-align: center; }
    input[type=checkbox] { width: 15px; height: 15px; cursor: pointer; accent-color: #4f46e5; }
    .loading { text-align: center; padding: 48px; color: #999; }
    .empty { text-align: center; padding: 48px; color: #bbb; }

    /* 批量操作工具列 */
    .batch-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1e1b4b; color: white; padding: 14px 24px; display: none; align-items: center; gap: 16px; z-index: 50; }
    .batch-bar.show { display: flex; }
    .batch-bar span { font-size: 14px; flex: 1; }
    .batch-del-btn { padding: 8px 20px; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .batch-del-btn:hover { background: #b91c1c; }
    .batch-cancel-btn { padding: 8px 16px; background: transparent; color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; cursor: pointer; font-size: 14px; }
    .batch-cancel-btn:hover { color: white; border-color: white; }

    /* 分類設定 */
    .cat-grid { display: grid; gap: 12px; }
    .cat-card { background: white; border-radius: 10px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); display: flex; align-items: flex-start; gap: 16px; }
    .cat-key { font-family: monospace; font-size: 13px; background: #f3f4f6; padding: 4px 10px; border-radius: 6px; color: #374151; white-space: nowrap; }
    .cat-info h3 { font-size: 15px; margin-bottom: 4px; }
    .cat-info p { font-size: 13px; color: #666; line-height: 1.5; }
    .cat-info .count { font-size: 12px; color: #4f46e5; margin-top: 4px; }

    /* 上傳區 */
    .upload-box { background: white; border-radius: 10px; padding: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .upload-drop { border: 2px dashed #ddd; border-radius: 10px; padding: 36px 20px; text-align: center; cursor: pointer; transition: border-color 0.2s; margin-bottom: 16px; }
    .upload-drop:hover, .upload-drop.drag-over { border-color: #4f46e5; background: #f5f3ff; }
    .upload-drop p { color: #888; font-size: 14px; margin-top: 8px; }
    .upload-drop strong { color: #4f46e5; }
    #upload-file-input { display: none; }
    .upload-btn { padding: 10px 24px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; width: auto; margin-top: 0; }
    .upload-btn:hover { background: #4338ca; }
    .upload-btn:disabled { background: #a5b4fc; cursor: not-allowed; }
    .format-hint { font-size: 12px; color: #999; margin-top: 12px; }
    /* 檔案清單 */
    .file-list { margin: 12px 0; display: flex; flex-direction: column; gap: 6px; }
    .file-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f9f9f9; border-radius: 8px; font-size: 13px; }
    .file-item .fname { flex: 1; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-status { font-size: 12px; white-space: nowrap; }
    .file-status.waiting { color: #9ca3af; }
    .file-status.processing { color: #4f46e5; }
    .file-status.done { color: #16a34a; }
    .file-status.error { color: #dc2626; }
    .upload-progress { font-size: 13px; color: #666; margin-bottom: 8px; }

    /* Toast */
    #toast { position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%) translateY(80px); background: #1a1a1a; color: white; padding: 10px 20px; border-radius: 8px; font-size: 14px; opacity: 0; transition: all 0.3s; pointer-events: none; z-index: 999; }
    #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    #toast.success { background: #16a34a; }
    #toast.error { background: #dc2626; }

    /* 確認對話框 */
    .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; align-items: center; justify-content: center; }
    .overlay.open { display: flex; }
    .dialog { background: white; border-radius: 12px; padding: 28px; width: 380px; }
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
      <div id="pages-table-wrap"><div class="loading">載入中...</div></div>
    </div>

    <!-- 分類設定 -->
    <div id="section-categories" class="section">
      <div id="cat-grid-wrap"><div class="loading">載入中...</div></div>
    </div>

    <!-- 上傳文件 -->
    <div id="section-upload" class="section">
      <div class="upload-box">
        <div class="upload-drop" id="upload-drop"
          onclick="document.getElementById('upload-file-input').click()"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="handleDrop(event)">
          <div style="font-size:40px">📂</div>
          <p><strong>點擊選擇</strong>或拖曳檔案到這裡</p>
          <p style="font-size:12px;margin-top:4px">可一次選取多個檔案</p>
        </div>
        <input type="file" id="upload-file-input" multiple
          accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.jpg,.jpeg,.png,.bmp,.txt,.md"
          onchange="onFilesSelected(this)">
        <div id="file-list" class="file-list"></div>
        <div id="upload-progress" class="upload-progress" style="display:none"></div>
        <button class="upload-btn" id="upload-btn" onclick="startBatchUpload()" disabled>開始上傳</button>
        <div class="format-hint">支援格式：PDF、Word（docx）、PowerPoint（pptx）、Excel（xlsx）、圖片（jpg/png）、純文字（txt/md）</div>
      </div>
    </div>
  </div>

  <!-- 批量操作工具列 -->
  <div class="batch-bar" id="batch-bar">
    <span id="batch-count-label"></span>
    <button class="batch-cancel-btn" onclick="clearSelection()">取消選取</button>
    <button class="batch-del-btn" onclick="confirmBatchDelete()">🗑️ 刪除選取</button>
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
    let selectedIds = new Set()

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
      pageCounts = {}
      allPages.forEach(p => { pageCounts[p.category] = (pageCounts[p.category] || 0) + 1 })
      selectedIds.clear()
      updateBatchBar()
      loadCategoryButtons()
      filterPages()
    }

    async function loadCategoryButtons() {
      const res = await fetch('/admin/api/categories')
      if (!res.ok) return
      const cats = await res.json()
      const container = document.querySelector('.filters')
      const allBtn = container.querySelector('[data-cat=""]')
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
      const allChecked = pages.length > 0 && pages.every(p => selectedIds.has(p.id))
      const rows = pages.map(p => {
        const date = new Date(p.updated_at).toLocaleDateString('zh-TW')
        const summary = (p.summary || '').slice(0, 80) + ((p.summary || '').length > 80 ? '...' : '')
        const checked = selectedIds.has(p.id) ? 'checked' : ''
        return \`<tr class="\${checked ? 'selected' : ''}">
          <td class="cb-cell"><input type="checkbox" \${checked} onchange="toggleSelect('\${p.id}', this.checked)"></td>
          <td class="title-cell"><strong>\${esc(p.title)}</strong><small>\${esc(p.source_file || '')}</small></td>
          <td><span class="badge">\${esc(p.category)}</span></td>
          <td class="summary-cell">\${esc(summary)}</td>
          <td>\${date}</td>
          <td><button class="del-btn" onclick="confirmDelete('\${p.id}', '\${esc(p.title)}')">刪除</button></td>
        </tr>\`
      }).join('')

      document.getElementById('pages-table-wrap').innerHTML = \`<table>
        <thead><tr>
          <th class="cb-cell"><input type="checkbox" \${allChecked ? 'checked' : ''} onchange="toggleSelectAll(this.checked)"></th>
          <th>標題 / 來源</th><th>分類</th><th>摘要</th><th>更新日期</th><th></th>
        </tr></thead>
        <tbody>\${rows}</tbody>
      </table>\`
    }

    // ── 勾選邏輯 ──
    function toggleSelect(id, checked) {
      checked ? selectedIds.add(id) : selectedIds.delete(id)
      updateBatchBar()
      // 更新該 row 樣式
      const cb = event.target
      cb.closest('tr').classList.toggle('selected', checked)
      // 更新全選框
      const visibleIds = getVisibleIds()
      const allChecked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id))
      const headerCb = document.querySelector('thead input[type=checkbox]')
      if (headerCb) headerCb.checked = allChecked
    }

    function toggleSelectAll(checked) {
      getVisibleIds().forEach(id => checked ? selectedIds.add(id) : selectedIds.delete(id))
      updateBatchBar()
      filterPages()
    }

    function getVisibleIds() {
      return Array.from(document.querySelectorAll('tbody input[type=checkbox]'))
        .map(cb => cb.closest('tr').querySelector('.del-btn').getAttribute('onclick').match(/'([^']+)'/)[1])
    }

    function clearSelection() {
      selectedIds.clear()
      updateBatchBar()
      filterPages()
    }

    function updateBatchBar() {
      const bar = document.getElementById('batch-bar')
      const n = selectedIds.size
      if (n > 0) {
        bar.classList.add('show')
        document.getElementById('batch-count-label').textContent = '已選取 ' + n + ' 個頁面'
      } else {
        bar.classList.remove('show')
      }
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
        <p style="margin-top:16px;font-size:13px;color:#999;">修改分類請至 <code>wrangler.toml</code> → <code>WIKI_CATEGORIES</code>，改完重新 deploy。</p>\`
    }

    // ── 單筆刪除 ──
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
        selectedIds.delete(id)
        updateBatchBar()
        filterPages()
        showToast('✅ 已刪除', 'success')
      } else {
        const err = await res.json().catch(() => ({}))
        showToast('❌ 刪除失敗：' + (err.error || res.status), 'error')
      }
    }

    // ── 批量刪除 ──
    function confirmBatchDelete() {
      const n = selectedIds.size
      if (n === 0) return
      document.getElementById('confirm-msg').textContent = '確定要刪除選取的 ' + n + ' 個頁面嗎？此操作無法復原。'
      document.getElementById('confirm-overlay').classList.add('open')
      document.getElementById('confirm-ok').onclick = doBatchDelete
    }

    async function doBatchDelete() {
      const ids = Array.from(selectedIds)
      closeConfirm()
      let done = 0, failed = 0
      for (const id of ids) {
        const res = await fetch('/admin/api/pages/' + id, { method: 'DELETE' })
        if (res.ok) { allPages = allPages.filter(p => p.id !== id); selectedIds.delete(id); done++ }
        else failed++
      }
      updateBatchBar()
      filterPages()
      if (failed === 0) showToast('✅ 已刪除 ' + done + ' 個頁面', 'success')
      else showToast('⚠️ 完成 ' + done + ' 個，失敗 ' + failed + ' 個', '')
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

    // ── 批量上傳 ──
    let uploadFiles = []   // Array of {file, status, pollTimer, pollSeconds}

    function onFilesSelected(input) {
      uploadFiles = Array.from(input.files).map(f => ({ file: f, status: 'waiting' }))
      renderFileList()
      document.getElementById('upload-btn').disabled = uploadFiles.length === 0
      document.getElementById('upload-progress').style.display = 'none'
    }

    function handleDrop(event) {
      event.preventDefault()
      document.getElementById('upload-drop').classList.remove('drag-over')
      const files = Array.from(event.dataTransfer.files).filter(f => {
        const ext = f.name.split('.').pop().toLowerCase()
        return ['pdf','docx','doc','pptx','ppt','xlsx','xls','jpg','jpeg','png','bmp','txt','md'].includes(ext)
      })
      if (!files.length) return
      uploadFiles = files.map(f => ({ file: f, status: 'waiting' }))
      renderFileList()
      document.getElementById('upload-btn').disabled = false
      document.getElementById('upload-progress').style.display = 'none'
    }

    function renderFileList() {
      const list = document.getElementById('file-list')
      if (!uploadFiles.length) { list.innerHTML = ''; return }
      list.innerHTML = uploadFiles.map((item, i) => {
        const statusText = { waiting: '等待中', processing: '處理中...', done: '✅ 完成', error: '❌ 失敗' }
        const statusClass = item.status
        return '<div class="file-item">' +
          '<span class="fname">' + esc(item.file.name) + '</span>' +
          '<span class="file-status ' + statusClass + '" id="fstatus-' + i + '">' + (statusText[item.status] || '') + '</span>' +
          '</div>'
      }).join('')
    }

    function setFileStatus(i, status, label) {
      uploadFiles[i].status = status
      const el = document.getElementById('fstatus-' + i)
      if (el) { el.className = 'file-status ' + status; el.textContent = label }
    }

    async function startBatchUpload() {
      if (!uploadFiles.length) return
      document.getElementById('upload-btn').disabled = true
      const total = uploadFiles.length
      let done = 0

      const progress = document.getElementById('upload-progress')
      progress.style.display = 'block'

      for (let i = 0; i < uploadFiles.length; i++) {
        const item = uploadFiles[i]
        setFileStatus(i, 'processing', '處理中...')
        progress.textContent = '上傳進度：' + done + ' / ' + total + ' 完成'

        try {
          const ext = item.file.name.split('.').pop().toLowerCase()
          const isText = ext === 'txt' || ext === 'md'

          if (isText) {
            const content = await item.file.text()
            const res = await fetch('/admin/api/upload/text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: item.file.name, content })
            })
            const data = await res.json()
            if (data.ok) { setFileStatus(i, 'done', '✅ 新增 ' + data.pages + ' 頁'); done++ }
            else { setFileStatus(i, 'error', '❌ ' + esc(data.error || '失敗')) }
          } else {
            const formData = new FormData()
            formData.append('file', item.file)
            const res = await fetch('/admin/api/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok || !data.ok) { setFileStatus(i, 'error', '❌ ' + esc(data.error || '上傳失敗')); continue }
            // 等待輪詢完成
            const result = await waitForTask(data.task_id, i)
            if (result.ok) { setFileStatus(i, 'done', '✅ 新增 ' + result.pages + ' 頁'); done++ }
            else { setFileStatus(i, 'error', '❌ ' + esc(result.error || '失敗')) }
          }
        } catch (err) {
          setFileStatus(i, 'error', '❌ ' + esc(String(err)))
        }

        progress.textContent = '上傳進度：' + done + ' / ' + total + ' 完成'
      }

      progress.textContent = '全部完成：' + done + ' / ' + total + ' 成功'
      document.getElementById('upload-btn').disabled = false
      if (done > 0) { loadPages(); showToast('✅ 成功上傳 ' + done + ' 個檔案', 'success') }
    }

    // 輪詢單一任務，回傳 {ok, pages, error}
    function waitForTask(taskId, fileIdx) {
      return new Promise(resolve => {
        let seconds = 0
        const poll = async () => {
          seconds += 5
          setFileStatus(fileIdx, 'processing', 'MinerU 轉換中...（' + seconds + 's）')
          try {
            const res = await fetch('/admin/api/upload/status/' + taskId)
            const data = await res.json()
            if (data.status === 'done') resolve({ ok: true, pages: data.pages, titles: data.titles })
            else if (data.status === 'error') resolve({ ok: false, error: data.error })
            else setTimeout(poll, 5000)
          } catch (err) {
            resolve({ ok: false, error: String(err) })
          }
        }
        setTimeout(poll, 5000)
      })
    }

    loadPages()
  </script>
</body>
</html>`
}
