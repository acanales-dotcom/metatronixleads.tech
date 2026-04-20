/* ============================================================
   ATTACHMENTS.JS — Panel contextual de documentos adjuntos
   Uso: openAttachments('invoice_out', id, 'FAC-2026-001')
   Requiere: app.js (getDB)
   Aislamiento: cada empresa ve solo sus propios archivos
   ============================================================ */

/* ── Shim: expone getActiveCompanyId globalmente si app.js aún no lo tiene ── */
if (typeof window.getActiveCompanyId !== 'function') {
  const _ATTACH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  window.getActiveCompanyId = function () {
    const s = window.MTX_ACTIVE_COMPANY?.id;
    if (s && _ATTACH_UUID_RE.test(s)) return s;
    const p = window._mtxCurrentUser?.profile?.company_id
           || window._currentUser?.profile?.company_id;
    if (p && _ATTACH_UUID_RE.test(p)) return p;
    return null;
  };
}

(function () {
  'use strict';

  /* ─── State ─────────────────────────────────────────────── */
  let _recordType  = null;
  let _recordId    = null;
  let _companyId   = null;
  let _label       = '';
  let _files       = [];
  let _uploading   = false;
  let _badgeMap    = {};   // recordId → count (for badge updates)

  const RECORD_LABELS = {
    invoice_out:    '📄 Factura por cobrar',
    invoice_in:     '📥 Factura por pagar',
    lead:           '🎯 Lead / Prospecto',
    requisition:    '📋 Requisición',
    purchase_order: '📦 Orden de Compra',
    general:        '📁 Documento general',
  };

  const MIME_ICONS = {
    'application/pdf':        '📄',
    'application/msword':     '📝',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
    'application/vnd.ms-excel': '📊',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
    'image/':                 '🖼️',
    'text/':                  '📃',
    'default':                '📎',
  };

  /* ─── Init: inject HTML once ────────────────────────────── */
  function initDrawer() {
    if (document.getElementById('attach-drawer')) return;

    const css = `
    <style id="attach-css">
    .attach-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:8998;display:none;animation:fadeIn .2s}
    .attach-overlay.open{display:block}
    .attach-drawer{
      position:fixed;top:0;right:0;height:100vh;width:400px;max-width:96vw;
      background:var(--surface2,#16181d);border-left:1px solid var(--border,#2a2d35);
      z-index:8999;transform:translateX(110%);transition:transform .28s cubic-bezier(.4,0,.2,1);
      display:flex;flex-direction:column;overflow:hidden;
    }
    .attach-drawer.open{transform:translateX(0)}
    .attach-header{
      display:flex;align-items:center;gap:10px;padding:14px 18px;
      border-bottom:1px solid var(--border,#2a2d35);flex-shrink:0;
    }
    .attach-header-icon{font-size:18px}
    .attach-header-info{flex:1;min-width:0}
    .attach-header-title{font-weight:700;font-size:14px;color:var(--text,#e8eaf0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .attach-header-sub{font-size:11px;color:var(--text-muted,#6b7080);margin-top:1px}
    .attach-close{background:none;border:none;color:var(--text-muted,#6b7080);font-size:20px;cursor:pointer;padding:2px 6px;border-radius:4px;line-height:1}
    .attach-close:hover{background:rgba(255,255,255,.06);color:var(--text,#e8eaf0)}

    .attach-body{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px}

    /* Upload zone */
    .attach-upload-zone{
      border:2px dashed var(--border,#2a2d35);border-radius:10px;padding:18px 12px;
      text-align:center;cursor:pointer;transition:.2s;position:relative;
    }
    .attach-upload-zone:hover,.attach-upload-zone.drag{border-color:var(--accent,#00ff88);background:rgba(0,255,136,.04)}
    .attach-upload-zone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
    .attach-upload-icon{font-size:22px;margin-bottom:4px}
    .attach-upload-text{font-size:12px;color:var(--text-muted,#6b7080)}
    .attach-upload-hint{font-size:10px;color:var(--text-faint,#4a4f60);margin-top:3px}

    /* Progress */
    .attach-progress{height:3px;background:var(--surface3,#1e2028);border-radius:2px;overflow:hidden;display:none}
    .attach-progress.visible{display:block}
    .attach-progress-bar{height:100%;background:var(--accent,#00ff88);width:0%;transition:width .3s}

    /* File list */
    .attach-section-title{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted,#6b7080)}
    .attach-file-list{display:flex;flex-direction:column;gap:6px}
    .attach-file-item{
      display:flex;align-items:center;gap:10px;padding:10px 12px;
      background:var(--surface3,#1e2028);border-radius:8px;border:1px solid var(--border,#2a2d35);
      transition:.15s;
    }
    .attach-file-item:hover{border-color:rgba(0,255,136,.25)}
    .attach-file-icon{font-size:20px;flex-shrink:0}
    .attach-file-info{flex:1;min-width:0}
    .attach-file-name{font-size:12px;font-weight:600;color:var(--text,#e8eaf0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .attach-file-meta{font-size:10px;color:var(--text-muted,#6b7080);margin-top:2px;font-family:monospace}
    .attach-file-actions{display:flex;gap:4px;flex-shrink:0}
    .attach-btn-icon{background:none;border:none;cursor:pointer;padding:4px 6px;border-radius:5px;font-size:14px;transition:.15s;color:var(--text-muted)}
    .attach-btn-icon:hover{background:rgba(255,255,255,.08);color:var(--text)}
    .attach-btn-del:hover{background:rgba(255,80,80,.12)!important;color:#ff5050!important}

    .attach-empty{text-align:center;padding:28px 0;color:var(--text-muted,#6b7080);font-size:13px}
    .attach-empty-icon{font-size:2rem;margin-bottom:8px}
    .attach-loading{text-align:center;padding:20px;color:var(--text-muted);font-size:12px}

    /* Toast */
    .attach-toast{
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:var(--surface2);border:1px solid var(--border);border-radius:8px;
      padding:10px 18px;font-size:13px;color:var(--text);z-index:9100;
      box-shadow:0 4px 20px rgba(0,0,0,.4);animation:attSlideUp .25s ease;
      display:none;
    }
    .attach-toast.visible{display:block}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes attSlideUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

    /* Badge on buttons */
    .attach-badge{
      display:inline-flex;align-items:center;justify-content:center;
      min-width:16px;height:16px;border-radius:8px;font-size:9px;font-weight:700;
      background:rgba(0,255,136,.15);color:var(--accent,#00ff88);padding:0 4px;margin-left:4px;
      vertical-align:middle;
    }
    .attach-badge.has-files{background:var(--accent,#00ff88);color:#000}
    </style>`;

    const html = `
    ${css}
    <div class="attach-overlay" id="attach-overlay" onclick="MTX_ATTACH.close()"></div>
    <div class="attach-drawer" id="attach-drawer" role="dialog" aria-label="Documentos adjuntos">
      <div class="attach-header">
        <div class="attach-header-icon" id="attach-hdr-icon">📎</div>
        <div class="attach-header-info">
          <div class="attach-header-title" id="attach-hdr-title">Documentos</div>
          <div class="attach-header-sub" id="attach-hdr-sub">—</div>
        </div>
        <button class="attach-close" onclick="MTX_ATTACH.close()" title="Cerrar">✕</button>
      </div>
      <div class="attach-body">
        <div class="attach-upload-zone" id="attach-drop-zone">
          <input type="file" id="attach-file-input" multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv">
          <div class="attach-upload-icon">☁️</div>
          <div class="attach-upload-text">Arrastra archivos aquí o haz click para seleccionar</div>
          <div class="attach-upload-hint">PDF, Word, Excel, Imágenes · Máx 50MB c/u</div>
        </div>
        <div class="attach-progress" id="attach-progress">
          <div class="attach-progress-bar" id="attach-progress-bar"></div>
        </div>
        <div>
          <div class="attach-section-title" id="attach-list-title">Archivos adjuntos</div>
          <div id="attach-file-list" style="margin-top:8px">
            <div class="attach-loading">Cargando...</div>
          </div>
        </div>
      </div>
    </div>
    <div class="attach-toast" id="attach-toast"></div>`;

    const wrapper = document.createElement('div');
    wrapper.id = 'attach-root';
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    // Drag & drop
    const zone = document.getElementById('attach-drop-zone');
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag');
      handleFiles(Array.from(e.dataTransfer.files));
    });

    // File input change
    document.getElementById('attach-file-input').addEventListener('change', e => {
      handleFiles(Array.from(e.target.files));
      e.target.value = '';
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') MTX_ATTACH.close();
    });
  }

  /* ─── Open / Close ──────────────────────────────────────── */
  async function openDrawer(recordType, recordId, label, companyId) {
    initDrawer();
    _recordType = recordType;
    _recordId   = recordId || null;
    _label      = label || '—';
    _companyId  = companyId || (typeof getActiveCompanyId === 'function' ? getActiveCompanyId() : null);

    document.getElementById('attach-hdr-icon').textContent  = RECORD_LABELS[recordType]?.split(' ')[0] || '📎';
    document.getElementById('attach-hdr-title').textContent = label || RECORD_LABELS[recordType] || 'Documentos';
    document.getElementById('attach-hdr-sub').textContent   = RECORD_LABELS[recordType] || recordType;
    document.getElementById('attach-overlay').classList.add('open');
    document.getElementById('attach-drawer').classList.add('open');

    await loadFiles();
  }

  function closeDrawer() {
    document.getElementById('attach-overlay')?.classList.remove('open');
    document.getElementById('attach-drawer')?.classList.remove('open');
  }

  /* ─── Load files ────────────────────────────────────────── */
  async function loadFiles() {
    const listEl = document.getElementById('attach-file-list');
    const titleEl = document.getElementById('attach-list-title');
    if (!listEl) return;
    listEl.innerHTML = '<div class="attach-loading">⏳ Cargando archivos...</div>';

    try {
      const db = (typeof getDB === 'function') ? getDB() : null;
      if (!db) throw new Error('No hay conexión a base de datos');

      let q = db.from('record_attachments')
        .select('id, file_name, file_size, mime_type, storage_path, created_at, record_label')
        .eq('record_type', _recordType)
        .eq('company_id', _companyId)
        .order('created_at', { ascending: false });

      if (_recordId) q = q.eq('record_id', _recordId);

      const { data, error } = await q;
      if (error) throw error;

      _files = data || [];
      if (titleEl) titleEl.textContent = `Archivos adjuntos (${_files.length})`;
      renderFileList();
      updateBadge(_recordId, _files.length);
    } catch (e) {
      listEl.innerHTML = `<div class="attach-empty"><div class="attach-empty-icon">⚠️</div>${escA(e.message)}</div>`;
    }
  }

  function renderFileList() {
    const listEl = document.getElementById('attach-file-list');
    if (!listEl) return;
    if (!_files.length) {
      listEl.innerHTML = '<div class="attach-empty"><div class="attach-empty-icon">📂</div>Sin archivos adjuntos aún.<br><small>Sube el primero usando el área de arriba.</small></div>';
      return;
    }
    listEl.innerHTML = _files.map(f => `
      <div class="attach-file-item" id="afile-${f.id}">
        <div class="attach-file-icon">${mimeIcon(f.mime_type)}</div>
        <div class="attach-file-info">
          <div class="attach-file-name" title="${escA(f.file_name)}">${escA(f.file_name)}</div>
          <div class="attach-file-meta">${fmtSize(f.file_size)} · ${fmtDate(f.created_at)}</div>
        </div>
        <div class="attach-file-actions">
          <button class="attach-btn-icon" title="Descargar" onclick="MTX_ATTACH.download('${escA(f.storage_path)}','${escA(f.file_name)}')">⬇️</button>
          <button class="attach-btn-icon attach-btn-del" title="Eliminar" onclick="MTX_ATTACH.del('${f.id}','${escA(f.storage_path)}','${escA(f.file_name)}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  /* ─── Upload ────────────────────────────────────────────── */
  async function handleFiles(files) {
    if (!files.length || _uploading) return;
    if (!_companyId) { showToast('⚠️ No hay empresa activa seleccionada', false); return; }

    _uploading = true;
    const prog = document.getElementById('attach-progress');
    const bar  = document.getElementById('attach-progress-bar');
    if (prog) prog.classList.add('visible');

    const db = (typeof getDB === 'function') ? getDB() : null;
    if (!db) { showToast('Sin conexión', false); _uploading = false; return; }

    let uploaded = 0;
    for (const file of files) {
      if (file.size > 209715200) { showToast(`❌ ${file.name} supera 200MB`, false); continue; }

      const ts       = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path     = `${_companyId}/${_recordType}/${_recordId || 'general'}/${ts}_${safeName}`;

      // Upload to Storage
      const { error: upErr } = await db.storage.from('docs').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });
      if (upErr) { showToast(`❌ ${file.name}: ${upErr.message}`, false); continue; }

      // Save metadata
      const session = await db.auth.getSession();
      const userId  = session?.data?.session?.user?.id || null;
      const { error: dbErr } = await db.from('record_attachments').insert({
        company_id:   _companyId,
        record_type:  _recordType,
        record_id:    _recordId || null,
        record_label: _label,
        file_name:    file.name,
        file_size:    file.size,
        mime_type:    file.type || null,
        storage_path: path,
        uploaded_by:  userId,
      });
      if (dbErr) {
        await db.storage.from('docs').remove([path]);
        showToast(`❌ Error guardando ${file.name}`, false); continue;
      }

      uploaded++;
      if (bar) bar.style.width = `${Math.round((uploaded / files.length) * 100)}%`;
    }

    _uploading = false;
    if (prog) { prog.classList.remove('visible'); if (bar) bar.style.width = '0%'; }
    if (uploaded > 0) {
      showToast(`✅ ${uploaded} archivo${uploaded>1?'s':''} subido${uploaded>1?'s':''}`);
      await loadFiles();
    }
  }

  /* ─── Download (signed URL) ─────────────────────────────── */
  async function downloadFile(storagePath, fileName) {
    const db = (typeof getDB === 'function') ? getDB() : null;
    if (!db) return;
    try {
      const { data, error } = await db.storage.from('docs').createSignedUrl(storagePath, 120);
      if (error || !data?.signedUrl) throw error || new Error('URL no disponible');
      const a = document.createElement('a');
      a.href = data.signedUrl; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { showToast('❌ No se pudo descargar: ' + e.message, false); }
  }

  /* ─── Delete ────────────────────────────────────────────── */
  async function deleteFile(id, storagePath, fileName) {
    if (!confirm(`¿Eliminar "${fileName}"?\nEsta acción no se puede deshacer.`)) return;
    const db = (typeof getDB === 'function') ? getDB() : null;
    if (!db) return;
    try {
      await db.storage.from('docs').remove([storagePath]);
      const { error } = await db.from('record_attachments').delete().eq('id', id);
      if (error) throw error;
      document.getElementById('afile-' + id)?.remove();
      _files = _files.filter(f => f.id !== id);
      document.getElementById('attach-list-title').textContent = `Archivos adjuntos (${_files.length})`;
      if (!_files.length) renderFileList();
      updateBadge(_recordId, _files.length);
      showToast('🗑️ Archivo eliminado');
    } catch (e) { showToast('❌ Error: ' + e.message, false); }
  }

  /* ─── Badge management ──────────────────────────────────── */
  function updateBadge(recordId, count) {
    if (!recordId) return;
    _badgeMap[recordId] = count;
    // Update all buttons that match this record
    document.querySelectorAll(`[data-attach-id="${recordId}"]`).forEach(btn => {
      let badge = btn.querySelector('.attach-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'attach-badge';
        btn.appendChild(badge);
      }
      badge.textContent = count > 0 ? count : '';
      badge.className = count > 0 ? 'attach-badge has-files' : 'attach-badge';
    });
  }

  /* Pre-load badge counts for a list of record IDs */
  async function preloadBadges(recordType, recordIds, companyId) {
    if (!recordIds?.length || !companyId) return;
    const db = (typeof getDB === 'function') ? getDB() : null;
    if (!db) return;
    try {
      const { data } = await db.from('record_attachments')
        .select('record_id')
        .eq('record_type', recordType)
        .eq('company_id', companyId)
        .in('record_id', recordIds);
      const counts = {};
      (data || []).forEach(r => { counts[r.record_id] = (counts[r.record_id] || 0) + 1; });
      recordIds.forEach(id => updateBadge(id, counts[id] || 0));
    } catch {}
  }

  /* ─── Helpers ───────────────────────────────────────────── */
  function mimeIcon(mime) {
    if (!mime) return MIME_ICONS.default;
    for (const [k, v] of Object.entries(MIME_ICONS)) {
      if (mime.startsWith(k)) return v;
    }
    return MIME_ICONS.default;
  }

  function fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1048576).toFixed(1) + ' MB';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
  }

  function escA(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  let _toastTimer = null;
  function showToast(msg, ok = true) {
    const el = document.getElementById('attach-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.borderLeftColor = ok ? 'var(--accent,#00ff88)' : 'var(--danger,#ff4646)';
    el.classList.add('visible');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
  }

  /* ─── Public API ────────────────────────────────────────── */
  window.MTX_ATTACH = {
    open:           openDrawer,
    close:          closeDrawer,
    download:       downloadFile,
    del:            deleteFile,
    preloadBadges:  preloadBadges,
    updateBadge:    updateBadge,
  };

})();
