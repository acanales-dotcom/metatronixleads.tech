// ============================================================
// METATRONIXLEADS.TECH — Core Application Logic
// ============================================================

let _supabase = null;

/* ── Supabase client ───────────────────────────────────────── */
function getDB() {
  if (!_supabase) {
    if (!window.MTX_CONFIG?.SUPABASE_URL || window.MTX_CONFIG.SUPABASE_URL.includes('YOURPROJECT')) {
      console.error('[MTX] config.js no configurado. Actualiza SUPABASE_URL y SUPABASE_ANON_KEY.');
      return null;
    }
    _supabase = window.supabase.createClient(
      window.MTX_CONFIG.SUPABASE_URL,
      window.MTX_CONFIG.SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );
  }
  return _supabase;
}

/* ── Auth helpers ──────────────────────────────────────────── */
async function getSession() {
  const db = getDB(); if (!db) return null;
  const { data: { session } } = await db.auth.getSession();
  return session;
}

async function getCurrentUser() {
  const db = getDB(); if (!db) return null;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  return { ...user, profile: profile || {} };
}

async function requireAuth(adminOnly = false) {
  const user = await getCurrentUser();
  if (!user) { window.location.href = '/index.html'; return null; }
  if (adminOnly && user.profile?.role !== 'admin') {
    window.location.href = '/dashboard.html'; return null;
  }
  // Actualizar last_seen
  getDB()?.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {});
  return user;
}

async function logout() {
  await getDB()?.auth.signOut();
  window.location.href = '/index.html';
}

/* ── Actividad ─────────────────────────────────────────────── */
async function logActivity(action, entityType = null, entityId = null, metadata = {}) {
  try {
    const { data: { user } } = await getDB().auth.getUser();
    if (!user) return;
    await getDB().from('activity_logs').insert({
      user_id: user.id, action, entity_type: entityType,
      entity_id: entityId, metadata
    });
  } catch (e) { /* silencioso */ }
}

/* ── Claude API ────────────────────────────────────────────── */
async function generateWithClaude(messages, onChunk, onDone, onError) {
  const proxyUrl = window.MTX_CONFIG?.CLAUDE_PROXY_URL;
  if (!proxyUrl || proxyUrl.includes('YOUR_')) {
    onError('CLAUDE_PROXY_URL no configurado en config.js');
    return;
  }
  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: 4096 })
    });
    if (!res.ok) { onError(`Error del servidor: ${res.status}`); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta' && json.delta?.text) {
            fullText += json.delta.text;
            onChunk(json.delta.text, fullText);
          }
        } catch (_) {}
      }
    }
    onDone(fullText);
  } catch (e) {
    onError(e.message || 'Error de red');
  }
}

/* ── Documentos ────────────────────────────────────────────── */
async function saveDocument(data) {
  const db = getDB();
  const { data: { user } } = await db.auth.getUser();
  const doc = {
    user_id: user.id,
    title: data.title,
    doc_type: data.doc_type,
    prompt: data.prompt,
    content: data.content,
    status: 'draft',
    word_count: data.content.replace(/<[^>]*>/g, '').split(/\s+/).length,
    updated_at: new Date().toISOString()
  };
  if (data.id) {
    const { data: updated, error } = await db.from('documents').update(doc).eq('id', data.id).select().single();
    if (error) throw error;
    return updated;
  } else {
    const { data: created, error } = await db.from('documents').insert(doc).select().single();
    if (error) throw error;
    await logActivity('create_document', 'document', created.id, { title: data.title, type: data.doc_type });
    return created;
  }
}

async function sendForReview(docId, message = '') {
  const db = getDB();
  const { data: { user } } = await db.auth.getUser();
  await db.from('documents').update({ status: 'pending_review', updated_at: new Date().toISOString() }).eq('id', docId);
  await db.from('alerts').insert({
    document_id: docId, sender_id: user.id,
    message: message || 'Documento enviado para revisión.',
    type: 'review'
  });
  await logActivity('send_for_review', 'document', docId);
}

/* ── Descarga ──────────────────────────────────────────────── */
function downloadDocument(title, htmlContent) {
  const full = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
  body { font-family: 'DM Sans', sans-serif; max-width: 800px; margin: 40px auto; padding: 40px;
         color: #111; line-height: 1.7; }
  h1,h2,h3 { font-weight: 600; margin-top: 2em; }
  h1 { border-bottom: 2px solid #000; padding-bottom: .5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td,th { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  @media print { body { margin: 0; padding: 20px; } }
</style>
</head>
<body>
${htmlContent}
<hr style="margin-top:60px">
<p style="font-size:11px;color:#999">Generado por MetaTronix Portal — IBANOR SA de CV</p>
</body>
</html>`;
  const blob = new Blob([full], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/* ── Alertas localStorage ──────────────────────────────────── */
function getAlerts() {
  try { return JSON.parse(localStorage.getItem('mtx_alerts') || '[]'); } catch { return []; }
}

function addAlert(alert) {
  const alerts = getAlerts();
  alerts.unshift({
    id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    read: false,
    created_at: new Date().toISOString(),
    ...alert,
  });
  if (alerts.length > 100) alerts.splice(100);
  localStorage.setItem('mtx_alerts', JSON.stringify(alerts));
  // Refresh badge if header is rendered
  refreshBellBadge();
}

function markAlertRead(alertId) {
  const alerts = getAlerts();
  const a = alerts.find(x => x.id === alertId);
  if (a) { a.read = true; localStorage.setItem('mtx_alerts', JSON.stringify(alerts)); }
  refreshBellBadge();
}

function refreshBellBadge() {
  const badge = document.getElementById('bell-badge');
  if (!badge) return;
  const user = window._mtxCurrentUser;
  if (!user) return;
  const isAdmin = user?.profile?.role === 'admin';
  const count = getAlerts().filter(a => !a.read && (
    (a.for_admin && isAdmin) || (a.for_user_id && a.for_user_id === user.id)
  )).length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

/* ── UI helpers ────────────────────────────────────────────── */
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function statusBadge(status) {
  const map = {
    draft:          ['Borrador',    'badge-neutral'],
    pending_review: ['En Revisión', 'badge-warning'],
    approved:       ['Aprobado',    'badge-success'],
    rejected:       ['Rechazado',   'badge-danger'],
    archived:       ['Archivado',   'badge-neutral'],
  };
  const [label, cls] = map[status] || ['Desconocido', 'badge-neutral'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function typeName(type) {
  const map = {
    propuesta:  'Propuesta Comercial',
    contrato:   'Contrato de Servicios',
    reporte:    'Reporte de Actividades',
    cotizacion: 'Cotización',
    carta:      'Carta Formal',
    tecnico:    'Documento Técnico',
    informe:    'Informe Ejecutivo',
    acuerdo:    'Acuerdo de Confidencialidad',
    manual:     'Manual de Procedimientos',
    general:    'General',
  };
  return map[type] || type;
}

function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${escHtml(msg)}</span>`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function renderHeader(user, activePage) {
  const isAdmin = user?.profile?.role === 'admin';
  const name = user?.profile?.full_name || user?.email || '—';
  // Store user globally for badge refresh
  window._mtxCurrentUser = user;
  // Calculate unread alerts
  const alerts = getAlerts();
  const unread = alerts.filter(a => !a.read && (
    (a.for_admin && isAdmin) || (a.for_user_id && a.for_user_id === user.id)
  )).length;
  const myAlerts = alerts.filter(a =>
    (a.for_admin && isAdmin) || (a.for_user_id && a.for_user_id === user.id)
  ).slice(0, 20);
  const alertIcons = { new_lead:'🎯', plan_submitted:'📋', plan_approved:'✅', plan_rejected:'❌' };

  const alertItems = myAlerts.length
    ? myAlerts.map(a => `
      <div class="bell-alert-item ${a.read ? '' : 'bell-alert-unread'}"
           onclick="handleAlertClick('${a.id}','${a.lead_id||''}')">
        <span style="font-size:15px;flex-shrink:0">${alertIcons[a.type]||'🔔'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:${a.read?'var(--text-muted)':'#fff'};line-height:1.4">${escHtml(a.message||'')}</div>
          <div style="font-size:10px;color:var(--text-faint);margin-top:2px;font-family:var(--font-mono)">${formatDate(a.created_at)}</div>
        </div>
        ${!a.read?'<span style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px"></span>':''}
      </div>`).join('')
    : '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">Sin alertas</div>';

  return `
  <style>
    .bell-wrap { position:relative; cursor:pointer; display:flex; align-items:center; }
    .bell-badge {
      position:absolute; top:-6px; right:-8px;
      min-width:16px; height:16px; border-radius:8px;
      background:#e03030; border:2px solid var(--bg,#0a0e17);
      font-size:9px; color:#fff; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      padding:0 3px; font-family:var(--font-mono);
    }
    .bell-dropdown {
      display:none; position:absolute; top:calc(100% + 10px); right:-8px;
      width:320px; background:var(--surface);
      border:1px solid var(--border); border-radius:var(--radius-lg);
      box-shadow:0 8px 32px rgba(0,0,0,.5); z-index:9999; overflow:hidden;
    }
    .bell-dropdown.open { display:block; }
    .bell-dropdown-head {
      padding:10px 16px; border-bottom:1px solid var(--border);
      font-size:11px; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:var(--text-muted);
    }
    .bell-alert-items { max-height:340px; overflow-y:auto; }
    .bell-alert-item {
      display:flex; gap:10px; align-items:flex-start;
      padding:10px 16px; border-bottom:1px solid var(--border2);
      cursor:pointer; transition:background .15s;
    }
    .bell-alert-item:hover { background:var(--surface2); }
    .bell-alert-unread { background:rgba(0,255,136,.04); }
  </style>
  <header class="app-header">
    <div class="header-brand">
      <span class="brand-title">METATRONIX</span>
      <span class="brand-sub">PORTAL</span>
    </div>
    <nav class="header-nav">
      <a href="/dashboard.html" class="${activePage==='dashboard'?'active':''}">Documentos</a>
      <a href="/leads.html" class="${activePage==='leads'?'active':''}">🎯 Leads</a>
      <a href="/generate.html" class="${activePage==='generate'?'active':''}">+ Generar</a>
      ${isAdmin ? `<a href="/admin.html" class="${activePage==='admin'?'active':''}">Admin</a>` : ''}
    </nav>
    <div class="header-user">
      <div class="bell-wrap" id="bell-wrap" onclick="toggleBellDropdown(event)">
        <span style="font-size:18px;line-height:1">🔔</span>
        <span class="bell-badge" id="bell-badge" style="${unread>0?'':'display:none'}">${unread}</span>
        <div class="bell-dropdown" id="bell-dropdown">
          <div class="bell-dropdown-head">Alertas</div>
          <div class="bell-alert-items">${alertItems}</div>
        </div>
      </div>
      <span class="user-name">${escHtml(name)}</span>
      ${isAdmin ? '<span class="badge badge-accent">Admin</span>' : ''}
      <button onclick="logout()" class="btn-ghost">Salir</button>
    </div>
  </header>`;
}

function toggleBellDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('bell-dropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) {
    setTimeout(() => document.addEventListener('click', closeBellDropdown, { once: true }), 0);
  }
}

function closeBellDropdown() {
  const dd = document.getElementById('bell-dropdown');
  if (dd) dd.classList.remove('open');
}

function handleAlertClick(alertId, leadId) {
  markAlertRead(alertId);
  // Re-render dropdown content
  const wrap = document.getElementById('bell-dropdown');
  if (wrap) {
    const user = window._mtxCurrentUser;
    const isAdmin = user?.profile?.role === 'admin';
    const alerts = getAlerts();
    const myAlerts = alerts.filter(a =>
      (a.for_admin && isAdmin) || (a.for_user_id && a.for_user_id === user?.id)
    ).slice(0, 20);
    const alertIcons = { new_lead:'🎯', plan_submitted:'📋', plan_approved:'✅', plan_rejected:'❌' };
    const items = wrap.querySelector('.bell-alert-items');
    if (items) {
      items.innerHTML = myAlerts.length
        ? myAlerts.map(a => `
          <div class="bell-alert-item ${a.read?'':'bell-alert-unread'}"
               onclick="handleAlertClick('${a.id}','${a.lead_id||''}')">
            <span style="font-size:15px;flex-shrink:0">${alertIcons[a.type]||'🔔'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:${a.read?'var(--text-muted)':'#fff'};line-height:1.4">${escHtml(a.message||'')}</div>
              <div style="font-size:10px;color:var(--text-faint);margin-top:2px;font-family:var(--font-mono)">${formatDate(a.created_at)}</div>
            </div>
            ${!a.read?'<span style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px"></span>':''}
          </div>`).join('')
        : '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">Sin alertas</div>';
    }
  }
  closeBellDropdown();
  if (leadId) window.location.href = '/leads.html';
}
