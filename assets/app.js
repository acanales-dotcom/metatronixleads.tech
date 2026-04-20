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

const ADMIN_ROLES = ['admin', 'admin_restringido', 'super_admin'];

async function requireAuth(adminOnly = false) {
  const user = await getCurrentUser();
  if (!user) { window.location.href = '/index.html'; return null; }
  const role = user.profile?.role;
  if (adminOnly && !ADMIN_ROLES.includes(role)) {
    window.location.href = '/dashboard.html'; return null;
  }
  // Actualizar last_seen
  getDB()?.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {});
  return user;
}

/* ── Control de uso Claude ─────────────────────────────────── */
async function checkClaudeAccess(userId) {
  const db = getDB();
  const { data: p } = await db.from('profiles').select(
    'claude_enabled, claude_monthly_limit, claude_usage_month, claude_reset_month, claude_pending_auth'
  ).eq('id', userId).single();
  if (!p) return { allowed: true }; // fallback si falla

  // Resetear contador si cambió el mes
  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  if (p.claude_reset_month !== thisMonth) {
    await db.from('profiles').update({
      claude_usage_month: 0,
      claude_reset_month: thisMonth,
      claude_pending_auth: false,
    }).eq('id', userId);
    p.claude_usage_month = 0;
    p.claude_pending_auth = false;
  }

  if (!p.claude_enabled) return { allowed: false, reason: 'disabled' };
  if (p.claude_pending_auth) return { allowed: false, reason: 'pending_auth' };
  if (p.claude_usage_month >= p.claude_monthly_limit) {
    // Marcar como pendiente de autorización y alertar al superAdmin
    await db.from('profiles').update({ claude_pending_auth: true }).eq('id', userId);
    const { data: { user } } = await db.auth.getUser();
    const name = user?.user_metadata?.full_name || user?.email || userId;
    addAlert({
      type: 'claude_limit_reached',
      message: `${name} alcanzó su límite mensual de Claude (${p.claude_monthly_limit} usos). Autorización requerida.`,
      for_super_admin: true,
      target_user_id: userId,
      target_user_name: name,
    });
    return { allowed: false, reason: 'limit_reached', used: p.claude_usage_month, limit: p.claude_monthly_limit };
  }
  return { allowed: true, used: p.claude_usage_month, limit: p.claude_monthly_limit };
}

async function incrementClaudeUsage(userId) {
  const db = getDB();
  await db.rpc('increment_claude_usage', { user_id_input: userId }).catch(() => {
    // Fallback si no existe la RPC: update manual
    db.from('profiles').select('claude_usage_month').eq('id', userId).single().then(({ data }) => {
      if (data) db.from('profiles').update({ claude_usage_month: (data.claude_usage_month || 0) + 1 }).eq('id', userId);
    });
  });
}

async function logout() {
  await getDB()?.auth.signOut();
  window.location.href = '/index.html';
}

/* ── Log de consultas LLM — registro para administradores ─── */
async function logLLMQuery(data) {
  try {
    const db = getDB();
    if (!db) return;
    const user = window._mtxCurrentUser;
    await db.from('activity_logs').insert({
      user_id:     user?.id || null,
      action:      'llm_query',
      entity_type: 'llm',
      entity_id:   null,
      metadata: {
        user_email:     user?.email || '',
        user_name:      user?.profile?.full_name || user?.email || '',
        page:           data.page || window.location.pathname.replace(/^\/|\.html$/g,'') || 'unknown',
        agent_name:     data.agentName || 'General',
        prompt_preview: String(data.prompt || '').slice(0, 250),
        response_chars: data.responseChars || 0,
        tokens_approx:  Math.round((data.responseChars || 0) / 4),
        duration_ms:    data.durationMs || 0,
        success:        data.success !== false,
        error_msg:      data.error || null,
        model:          data.model || 'claude-haiku-4-5-20251001',
      }
    });
  } catch(_) { /* silencioso — nunca debe interrumpir la UI */ }
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
    // Inyectar JWT de Supabase para autenticación con el Worker v2
    let _authH = {};
    try {
      const _db = getDB();
      if (_db) {
        const { data: _sd } = await _db.auth.getSession();
        const _tok = _sd?.session?.access_token;
        if (_tok) _authH = { 'Authorization': `Bearer ${_tok}` };
      }
    } catch (_) {}

    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._authH },
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
  const role = user?.profile?.role;
  const isAdmin = role === 'admin';
  const isSA = role === 'super_admin';
  const count = getAlerts().filter(a => !a.read && (
    (a.for_admin && (isAdmin || isSA)) ||
    (a.for_super_admin && isSA) ||
    (a.for_user_id && a.for_user_id === user.id)
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

const IBANOR_EMAILS = ['acanales@ibanormexico.com','nibarra@ibanormexico.com','acanalesf@ibanormexico.com'];

function renderHeader(user, activePage) {
  const role = user?.profile?.role;
  const department = (user?.profile?.department || '').toLowerCase().trim();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const isRestrictedAdmin = role === 'admin_restringido';
  const hasAdminAccess = ADMIN_ROLES.includes(role);
  const isDirVentas = isRestrictedAdmin && department === 'ventas';
  const userEmail = (user?.email || '').toLowerCase().trim();
  const hasIbanorAccess = IBANOR_EMAILS.includes(userEmail);
  const name = user?.profile?.full_name || user?.email || '—';
  // Store user globally for badge refresh
  window._mtxCurrentUser = user;
  // Calculate unread alerts
  const alerts = getAlerts();
  const unread = alerts.filter(a => !a.read && (
    (a.for_admin && (isAdmin || isSuperAdmin)) ||
    (a.for_super_admin && isSuperAdmin) ||
    (a.for_user_id && a.for_user_id === user.id)
  )).length;
  const myAlerts = alerts.filter(a =>
    (a.for_admin && (isAdmin || isSuperAdmin)) ||
    (a.for_super_admin && isSuperAdmin) ||
    (a.for_user_id && a.for_user_id === user.id)
  ).slice(0, 20);
  const alertIcons = { new_lead:'🎯', plan_submitted:'📋', plan_approved:'✅', plan_rejected:'❌', claude_limit_reached:'⚠️', claude_authorized:'✅', perplexity_access_request:'🔍', perplexity_authorized:'🔍' };

  const alertItems = myAlerts.length
    ? myAlerts.map(a => `
      <div class="bell-alert-item ${a.read ? '' : 'bell-alert-unread'}"
           onclick="handleAlertClick('${a.id}','${a.lead_id||''}')">
        <span style="font-size:15px;flex-shrink:0">${alertIcons[a.type]||'🔔'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:${a.read?'var(--text-muted)':'var(--text)'};line-height:1.4">${escHtml(a.message||'')}</div>
          <div style="font-size:10px;color:var(--text-faint);margin-top:2px;font-family:var(--font-mono)">${formatDate(a.created_at)}</div>
        </div>
        ${!a.read?'<span style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px"></span>':''}
      </div>`).join('')
    : '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">Sin alertas</div>';

  const roleBadge = isSuperAdmin
    ? '<span class="sidebar-role-badge" style="background:#7c3aed;color:#fff">CEO</span>'
    : isAdmin
      ? '<span class="sidebar-role-badge" style="background:var(--accent);color:#000">Director</span>'
      : isDirVentas
        ? '<span class="sidebar-role-badge" style="background:#f97316;color:#fff">Dir. Ventas</span>'
        : isRestrictedAdmin
          ? '<span class="sidebar-role-badge" style="background:var(--warning);color:#000">Gerente</span>'
          : '';

  return `
  <style>
    body { padding-left: var(--sidebar-w, 220px); }
    /* Bell dropdown */
    .bell-wrap { position:relative; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .bell-badge {
      position:absolute; top:-4px; right:-4px;
      min-width:15px; height:15px; border-radius:8px;
      background:#EF4444; border:2px solid var(--bg-2,#10141F);
      font-size:9px; color:#fff; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      padding:0 3px; font-family:var(--font-mono);
    }
    .bell-dropdown {
      display:none; position:fixed; bottom:80px; left:calc(var(--sidebar-w,220px) + 8px);
      width:340px; background:#fff;
      border:1px solid var(--border); border-radius:var(--radius-lg);
      box-shadow:0 8px 32px rgba(0,30,80,.15); z-index:9999; overflow:hidden;
    }
    .bell-dropdown.open { display:block; animation:slideUp .15s ease; }
    .bell-dropdown-head {
      padding:12px 16px; border-bottom:1px solid var(--border);
      font-size:11px; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:var(--text-muted);
      display:flex; justify-content:space-between; align-items:center;
      background:var(--surface);
    }
    .bell-alert-items { max-height:380px; overflow-y:auto; }
    .bell-alert-item {
      display:flex; gap:10px; align-items:flex-start;
      padding:10px 16px; border-bottom:1px solid var(--border);
      cursor:pointer; transition:background .12s;
    }
    .bell-alert-item:hover { background:var(--surface2); }
    .bell-alert-unread { background:var(--accent-dim); border-left:2px solid var(--accent); }
    /* Sidebar section labels */
    .sidebar-section-label {
      padding:10px 16px 4px; font-size:10px; font-weight:700;
      letter-spacing:.12em; text-transform:uppercase; color:var(--text-faint);
    }
    .sidebar-divider { height:1px; background:var(--border); margin:6px 0; }
  /* Company switcher */
  .company-switcher {
    margin: 0 10px 4px; border-radius: 7px;
    border: 1px solid rgba(0,194,224,.25); background: rgba(0,194,224,.05);
    overflow: hidden;
  }
  .company-switcher-current {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 11px; cursor: pointer; transition: background .1s;
  }
  .company-switcher-current:hover { background: rgba(0,194,224,.08); }
  .company-switcher-icon { font-size: 13px; flex-shrink: 0; }
  .company-switcher-name { font-size: 11px; font-weight: 700; color: var(--cyan); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .company-switcher-arrow { font-size: 9px; color: var(--text-muted); transition: transform .15s; }
  .company-switcher-arrow.open { transform: rotate(180deg); }
  .company-switcher-list { display: none; border-top: 1px solid rgba(0,194,224,.15); max-height: 180px; overflow-y: auto; }
  .company-switcher-list.open { display: block; }
  .company-switcher-item {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 11px; cursor: pointer; font-size: 11px;
    color: var(--text-muted); transition: background .1s; border-bottom: 1px solid var(--border);
  }
  .company-switcher-item:last-child { border-bottom: none; }
  .company-switcher-item:hover { background: rgba(255,255,255,.04); color: var(--text); }
  .company-switcher-item.active { color: var(--cyan); font-weight: 700; }
  .company-switcher-item.active::after { content: '✓'; margin-left: auto; font-size: 10px; }
  </style>
  <aside class="app-sidebar" aria-label="Panel lateral">

    <!-- Brand -->
    <a href="/home.html" class="sidebar-brand" style="text-decoration:none">
      <div class="sidebar-brand-logo">
        <span class="sidebar-brand-logo-letter">M</span>
      </div>
      <div class="sidebar-brand-text">
        <span class="sidebar-brand-title">METATRONIX</span>
        <span class="sidebar-brand-sub">PORTAL</span>
      </div>
    </a>

    ${isSuperAdmin ? `
    <!-- Company Switcher (super_admin only) -->
    <div class="company-switcher" id="company-switcher-widget">
      <div class="company-switcher-current" onclick="toggleCompanySwitcher(event)">
        <span class="company-switcher-icon">🏢</span>
        <span class="company-switcher-name" id="company-switcher-name">Cargando...</span>
        <span class="company-switcher-arrow" id="company-switcher-arrow">▾</span>
      </div>
      <div class="company-switcher-list" id="company-switcher-list">
        <div class="company-switcher-item" style="opacity:.5;cursor:default">Cargando empresas...</div>
      </div>
    </div>` : ''}

    <!-- Navigation — 5 primary modules + tools -->
    <nav class="sidebar-nav" aria-label="Navegación principal" role="navigation">

      <!-- PRIMARY 5 MODULES (always visible, top) -->
      <a href="/home.html" class="sidebar-nav-link ${activePage==='home'?'active':''}" id="nav-home">
        <span class="nav-icon">⌂</span>
        <span class="nav-label">Inicio</span>
      </a>

      <div class="sidebar-divider"></div>

      <!-- VENTAS -->
      <div class="sidebar-section-label">Ventas</div>
      <a href="/leads.html" class="sidebar-nav-link ${activePage==='leads'?'active':''}">
        <span class="nav-icon">◈</span>
        <span class="nav-label">Pipeline</span>
        <span class="nav-count" id="nav-count-pipeline">—</span>
      </a>
      <a href="/home.html#cuentas" class="sidebar-nav-link ${activePage==='cuentas'?'active':''}">
        <span class="nav-icon">◉</span>
        <span class="nav-label">Cuentas</span>
      </a>
      <a href="/home.html#actividad" class="sidebar-nav-link ${activePage==='actividad'?'active':''}">
        <span class="nav-icon">◎</span>
        <span class="nav-label">Actividad</span>
        <span class="nav-count" id="nav-count-tasks" style="display:none">0</span>
      </a>
      <a href="/home.html#reportes" class="sidebar-nav-link ${activePage==='reportes'?'active':''}">
        <span class="nav-icon">◇</span>
        <span class="nav-label">Reportes</span>
      </a>
      <a href="/ventas.html" class="sidebar-nav-link ${activePage==='ventas'?'active':''}">
        <span class="nav-icon">💰</span>
        <span class="nav-label">MetaVentax AI</span>
      </a>

      <div class="sidebar-divider"></div>

      <!-- MARKETING TOOLS -->
      <div class="sidebar-section-label">Marketing</div>
      <a href="/oportunidades.html" class="sidebar-nav-link ${activePage==='oportunidades'?'active':''}">
        <span class="nav-icon">🔍</span>
        <span class="nav-label">Inteligencia de Mercados</span>
      </a>
      <a href="/marketing.html" class="sidebar-nav-link ${activePage==='marketing'?'active':''}">
        <span class="nav-icon">📣</span>
        <span class="nav-label">MetaMKTX</span>
      </a>
      <a href="/captureform.html" class="sidebar-nav-link" target="_blank" title="Formulario público de captura de leads">
        <span class="nav-icon">↗</span>
        <span class="nav-label">Formulario Web</span>
      </a>

      <div class="sidebar-divider"></div>

      <!-- ADMINISTRACIÓN (admin/super_admin — NO Director de Ventas) -->
      ${hasAdminAccess && !isDirVentas ? `
      <div class="sidebar-section-label">Administración</div>
      <a href="/ceo.html" class="sidebar-nav-link ${activePage==='ceo'?'active':''}">
        <span class="nav-icon">🎯</span>
        <span class="nav-label">CEO Command Center</span>
      </a>
      <a href="/consejo.html" class="sidebar-nav-link ${activePage==='consejo'?'active':''}">
        <span class="nav-icon">🏛</span>
        <span class="nav-label">Consejo Ejecutivo</span>
      </a>
      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">Directores IA</div>
      <a href="/ventas.html#director" class="sidebar-nav-link ${activePage==='director-ventas'?'active':''}">
        <span class="nav-icon">📈</span>
        <span class="nav-label">Dir. Comercial</span>
      </a>
      <a href="/marketing.html#director" class="sidebar-nav-link ${activePage==='director-marketing'?'active':''}">
        <span class="nav-icon">🎯</span>
        <span class="nav-label">Dir. Marketing</span>
      </a>
      <a href="/director-ops.html" class="sidebar-nav-link ${activePage==='director-ops'?'active':''}">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">Dir. Operaciones</span>
      </a>
      <a href="/finanzas.html#director" class="sidebar-nav-link ${activePage==='director-admin'?'active':''}">
        <span class="nav-icon">💼</span>
        <span class="nav-label">Dir. Administrativo</span>
      </a>
      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">Finanzas & Operación</div>
      <a href="/finanzas.html" class="sidebar-nav-link ${activePage==='finanzas'?'active':''}">
        <span class="nav-icon">📊</span>
        <span class="nav-label">Finanzas & Flujo</span>
      </a>
      <a href="/cobranza.html" class="sidebar-nav-link ${activePage==='cobranza'?'active':''}">
        <span class="nav-icon">📞</span>
        <span class="nav-label">Cobranza IA</span>
      </a>
      <a href="/compras.html" class="sidebar-nav-link ${activePage==='compras'?'active':''}">
        <span class="nav-icon">🛒</span>
        <span class="nav-label">Compras & POs</span>
      </a>
      <a href="/facturacion.html" class="sidebar-nav-link ${activePage==='facturacion'?'active':''}">
        <span class="nav-icon">📄</span>
        <span class="nav-label">Facturación</span>
      </a>
      <div class="sidebar-divider"></div>` : ''}

      <!-- DOCUMENTOS -->
      <div class="sidebar-section-label">Documentos</div>
      <a href="/documentos.html" class="sidebar-nav-link ${activePage==='documentos'?'active':''}">
        <span class="nav-icon">📁</span>
        <span class="nav-label">Biblioteca Docs</span>
      </a>
      <a href="/dashboard.html" class="sidebar-nav-link ${activePage==='dashboard'?'active':''}">
        <span class="nav-icon">📋</span>
        <span class="nav-label">Adm. de Venta</span>
      </a>
      <a href="/dashboard-mkt.html" class="sidebar-nav-link ${activePage==='dashboard-mkt'?'active':''}">
        <span class="nav-icon">📣</span>
        <span class="nav-label">Adm. de Mkt</span>
      </a>
      <a href="/mtx-docs.html" class="sidebar-nav-link ${activePage==='mtx-docs'?'active':''}">
        <span class="nav-icon">🤝</span>
        <span class="nav-label">Docs Compartidos Org</span>
      </a>
      <a href="/docs-admin.html" class="sidebar-nav-link ${activePage==='docs-admin'?'active':''}">
        <span class="nav-icon">🗃</span>
        <span class="nav-label">Docs Administrativos</span>
      </a>

      <div class="sidebar-divider"></div>

      <!-- HERRAMIENTAS -->
      <div class="sidebar-section-label">Herramientas</div>
      <a href="/generate.html" class="sidebar-nav-link ${activePage==='generate'?'active':''}">
        <span class="nav-icon">✨</span>
        <span class="nav-label">Generador IA</span>
      </a>

      <!-- SISTEMA (admin/superadmin) -->
      ${hasAdminAccess ? `
      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">Sistema</div>
      <a href="/admin.html" class="sidebar-nav-link ${activePage==='admin'?'active':''}">
        <span class="nav-icon">⚙</span>
        <span class="nav-label">Panel Sistema</span>
      </a>
      <a href="/empresas.html" class="sidebar-nav-link ${activePage==='empresas'?'active':''}">
        <span class="nav-icon">🏢</span>
        <span class="nav-label">Empresas</span>
      </a>` : ''}
      ${isSuperAdmin ? `
      <a href="/security-audit.html" class="sidebar-nav-link ${activePage==='security-audit'?'active':''}" style="color:var(--red)">
        <span class="nav-icon">🛡</span>
        <span class="nav-label">Seguridad & Auditoría</span>
      </a>
      <a href="/privacy.html" class="sidebar-nav-link ${activePage==='privacy'?'active':''}">
        <span class="nav-icon">🔒</span>
        <span class="nav-label">Privacidad / SOC 2</span>
      </a>` : ''}

    </nav>

    <!-- Footer: user + bell -->
    <div class="sidebar-footer">
      <div class="sidebar-user-card">
        <div class="sidebar-user-avatar">${escHtml((name[0]||'U').toUpperCase())}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${escHtml(name)}</div>
          ${roleBadge}
        </div>
        <div class="bell-wrap" id="bell-wrap" onclick="toggleBellDropdown(event)" title="Notificaciones"
             style="margin-left:auto;padding:4px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="bell-badge" id="bell-badge" style="${unread>0?'':'display:none'}">${unread}</span>
          <div class="bell-dropdown" id="bell-dropdown">
            <div class="bell-dropdown-head">
              <span>Notificaciones</span>
              ${unread>0?`<span style="font-size:10px;background:var(--accent-dim);color:var(--accent);padding:2px 6px;border-radius:3px;font-weight:700">${unread} nueva${unread!==1?'s':''}</span>`:''}
            </div>
            <div class="bell-alert-items">${alertItems}</div>
            <div style="padding:8px 16px;border-top:1px solid var(--border);display:flex;justify-content:center">
              <a href="/admin.html" style="font-size:11px;color:var(--accent);text-decoration:none">Ver todas →</a>
            </div>
          </div>
        </div>
      </div>
      <button onclick="logout()" class="btn-ghost btn-sm sidebar-logout" style="width:100%;justify-content:center;gap:6px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Cerrar sesión
      </button>
    </div>
  </aside>`;
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

// ── Company Switcher ──────────────────────────────────────────────────────
window.MTX_ACTIVE_COMPANY = JSON.parse(sessionStorage.getItem('mtx_active_company') || 'null');

/**
 * Retorna el company_id activo: primero el switcher, luego el perfil del usuario.
 * Solo retorna valores que sean UUIDs válidos (evita slugs como 'ibanor').
 */
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v) { return typeof v === 'string' && _UUID_RE.test(v); }

function getActiveCompanyId() {
  const fromSwitcher = window.MTX_ACTIVE_COMPANY?.id;
  if (isValidUUID(fromSwitcher)) return fromSwitcher;
  const fromProfile = window._mtxCurrentUser?.profile?.company_id;
  if (isValidUUID(fromProfile)) return fromProfile;
  return null;
}

/**
 * Aplica .eq('company_id', id) a un query Supabase si hay empresa activa.
 * Ejemplo: const { data } = await applyCompanyFilter(db.from('leads').select('*'));
 */
function applyCompanyFilter(query) {
  const id = getActiveCompanyId();
  return id ? query.eq('company_id', id) : query;
}

/**
 * Retorna el nombre de la empresa activa para mostrar en UI.
 */
function getActiveCompanyName() {
  return window.MTX_ACTIVE_COMPANY?.name
    || window._mtxCurrentUser?.profile?.company_name
    || 'Mi Empresa';
}

function toggleCompanySwitcher(e) {
  e.stopPropagation();
  const list  = document.getElementById('company-switcher-list');
  const arrow = document.getElementById('company-switcher-arrow');
  if (!list) return;
  const opening = !list.classList.contains('open');
  list.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open');
  if (opening) {
    loadCompanySwitcher();
    setTimeout(() => document.addEventListener('click', closeCompanySwitcher, { once: true }), 0);
  }
}

function closeCompanySwitcher() {
  const list  = document.getElementById('company-switcher-list');
  const arrow = document.getElementById('company-switcher-arrow');
  if (list)  list.classList.remove('open');
  if (arrow) arrow.classList.remove('open');
}

async function loadCompanySwitcher() {
  const list = document.getElementById('company-switcher-list');
  const nameEl = document.getElementById('company-switcher-name');
  if (!list) return;

  // Update display name
  const active = window.MTX_ACTIVE_COMPANY;
  if (nameEl) nameEl.textContent = active?.name || 'Selecciona empresa';

  try {
    const db = getSupabase();
    const user = window._mtxCurrentUser;
    const isAdminRole = ['admin','super_admin'].includes(user?.profile?.role);

    let companies, error;

    if (isAdminRole) {
      // Admins ven todas las empresas (sin filtro de status para compatibilidad con ambos esquemas)
      ({ data: companies, error } = await db
        .from('companies')
        .select('id, name, rfc, status, slug')
        .order('name'));
    } else {
      // Usuarios normales: solo empresas a las que pertenecen
      const { data: memberships, error: mErr } = await db
        .from('user_companies')
        .select('company_id, companies(id, name, rfc, status)')
        .eq('user_id', user?.id);
      if (mErr) throw mErr;
      companies = (memberships || [])
        .map(m => m.companies)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (error) throw error;

    // Auto-seleccionar empresa si solo hay una y no hay activa
    if (!window.MTX_ACTIVE_COMPANY && companies?.length === 1) {
      selectCompany(companies[0]);
      return;
    }

    // Solo super_admin puede ver "Todas las empresas"
    const items = isAdminRole
      ? [{ id: null, name: 'Todas las empresas', rfc: '', status: 'activo' }, ...(companies || [])]
      : (companies || []);

    if (!items.length) {
      list.innerHTML = '<div class="company-switcher-item" style="color:var(--text-faint);cursor:default;font-size:12px">Sin empresas asignadas</div>';
      return;
    }

    list.innerHTML = items.map(c => `
      <div class="company-switcher-item ${(active?.id || null) === c.id ? 'active' : ''}"
           onclick="selectCompany(${c.id ? JSON.stringify(c) : 'null'})">
        <span style="font-size:11px">${c.id ? '🏢' : '🌐'}</span>
        <div style="flex:1;min-width:0">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.name)}</div>
          ${c.rfc ? `<div style="font-size:9px;color:var(--text-faint);font-family:var(--font-mono)">${escHtml(c.rfc)}</div>` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="company-switcher-item" style="color:var(--red);cursor:default">Error: ${escHtml(err.message)}</div>`;
  }
}

function selectCompany(company) {
  window.MTX_ACTIVE_COMPANY = company;
  sessionStorage.setItem('mtx_active_company', JSON.stringify(company));
  const nameEl = document.getElementById('company-switcher-name');
  if (nameEl) nameEl.textContent = company?.name || 'Todas las empresas';
  closeCompanySwitcher();
  // Dispatch event so pages can react to company switch
  window.dispatchEvent(new CustomEvent('mtx:companySwitch', { detail: company }));
  // Update active state in list
  document.querySelectorAll('.company-switcher-item').forEach(el => {
    el.classList.remove('active');
    el.style.removeProperty('fontWeight');
  });
  showToast(`Empresa: ${company?.name || 'Todas las empresas'}`, 'success');
  // Reload page data after a brief delay to let toast show
  setTimeout(() => window.location.reload(), 800);
}

// Init company switcher display name on page load
(function initCompanySwitcherDisplay() {
  // This runs after renderHeader injects the sidebar
  const observer = new MutationObserver(() => {
    const nameEl = document.getElementById('company-switcher-name');
    if (nameEl) {
      nameEl.textContent = window.MTX_ACTIVE_COMPANY?.name || 'Todas las empresas';
      observer.disconnect();
    }
  });
  const target = document.body || document.documentElement;
  if (target) observer.observe(target, { childList: true, subtree: true });
})();

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
    const alertIcons = { new_lead:'🎯', plan_submitted:'📋', plan_approved:'✅', plan_rejected:'❌', claude_limit_reached:'⚠️', claude_authorized:'✅', perplexity_access_request:'🔍', perplexity_authorized:'🔍' };
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

/* ═══════════════════════════════════════════════════════════
   SECURITY HARDENING — SOC 2 Type II / ISO 27001:2022
   ═══════════════════════════════════════════════════════════ */

/* ── CSP Injection: agrega headers de seguridad vía meta ── */
function injectSecurityHeaders() {
  const head = document.head;
  if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;

  // Content Security Policy
  const csp = document.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.run https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net https://unpkg.com https://huggingface.co https://*.workers.dev https://api.anthropic.com wss://*.supabase.co",
    "worker-src blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  head.insertBefore(csp, head.firstChild);

  // X-Frame-Options (via meta equiv)
  const xframe = document.createElement('meta');
  xframe.httpEquiv = 'X-Frame-Options';
  xframe.content = 'DENY';
  head.insertBefore(xframe, head.firstChild);

  // Referrer Policy
  const ref = document.createElement('meta');
  ref.name    = 'referrer';
  ref.content = 'strict-origin-when-cross-origin';
  head.appendChild(ref);
}

/* ── Session timeout: 8h idle → force re-login ─────────── */
let _idleTimer = null;
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

function resetIdleTimer() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(async () => {
    const db = getDB();
    if (db) await db.auth.signOut();
    window.location.href = '/index.html?reason=session_timeout';
  }, SESSION_TIMEOUT_MS);
}

function initSessionTimeout() {
  ['mousemove','keydown','click','touchstart','scroll'].forEach(ev =>
    document.addEventListener(ev, resetIdleTimer, { passive: true })
  );
  resetIdleTimer();
}

/* ── Rate limiter: protege operaciones críticas ─────────── */
const _rateLimits = {};
function rateLimitCheck(key, maxCalls = 10, windowMs = 60000) {
  const now = Date.now();
  if (!_rateLimits[key]) _rateLimits[key] = [];
  _rateLimits[key] = _rateLimits[key].filter(t => now - t < windowMs);
  if (_rateLimits[key].length >= maxCalls) {
    console.warn(`[SECURITY] Rate limit reached for: ${key}`);
    return false;
  }
  _rateLimits[key].push(now);
  return true;
}

/* ── Enhanced escHtml with URL sanitization ─────────────── */
const _origEscHtml = escHtml;
function escHtml(s) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/* Sanitize URL to prevent javascript: protocol */
function safeUrl(url) {
  if (!url) return '#';
  const lower = url.trim().toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) return '#';
  return url;
}

/* ── Input sanitizer for forms ──────────────────────────── */
function sanitizeInput(value, type = 'text') {
  if (!value) return '';
  const str = String(value).trim();
  switch(type) {
    case 'email':   return str.toLowerCase().replace(/[^a-z0-9@._+-]/gi, '').slice(0, 255);
    case 'phone':   return str.replace(/[^0-9+\-\s()ext.]/gi, '').slice(0, 30);
    case 'number':  return str.replace(/[^0-9.,\-]/g, '').slice(0, 20);
    case 'alphanumeric': return str.replace(/[^a-z0-9\s\-_.@]/gi, '').slice(0, 500);
    default:        return str.slice(0, 2000); // max text length
  }
}

/* ── Security event logger ──────────────────────────────── */
async function logSecurityEvent(event, details = {}) {
  try {
    const db = getDB();
    if (!db) return;
    await db.from('activity_logs').insert({
      user_id:     window._mtxCurrentUser?.id || null,
      action:      `security.${event}`,
      entity_type: 'security',
      entity_id:   null,
      metadata: {
        ...details,
        user_agent:  navigator.userAgent.slice(0, 200),
        page:        window.location.pathname,
        timestamp:   new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('[SECURITY] Failed to log security event:', e.message);
  }
}

/* ── Detect and block suspicious activity ───────────────── */
function initSecurityMonitor() {
  // Detect devtools open (basic heuristic)
  let devtoolsOpen = false;
  const threshold = 160;
  setInterval(() => {
    if (window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        logSecurityEvent('devtools_open', { page: window.location.pathname });
      }
    } else {
      devtoolsOpen = false;
    }
  }, 5000);

  // Log page load
  logSecurityEvent('page_load', { page: window.location.pathname });

  // Log failed auth attempts (will be called from requireAuth)
  window.MTX_SECURITY_MONITOR = true;
}

/* ═══════════════════════════════════════════════════════════
   MOBILE SIDEBAR — hamburger + overlay
   ═══════════════════════════════════════════════════════════ */
function initMobileSidebar() {
  if (document.querySelector('.app-hamburger')) return; // ya inicializado

  // Botón hamburguesa
  const btn = document.createElement('button');
  btn.className   = 'app-hamburger';
  btn.setAttribute('aria-label', 'Abrir navegación');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML   = '<span></span><span></span><span></span>';
  btn.addEventListener('click', toggleMobileSidebar);
  document.body.appendChild(btn);

  // Overlay oscuro
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-mobile-overlay';
  overlay.addEventListener('click', closeMobileSidebar);
  document.body.appendChild(overlay);
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const overlay = document.querySelector('.sidebar-mobile-overlay');
  const btn     = document.querySelector('.app-hamburger');
  const isOpen  = sidebar?.classList.contains('mobile-open');
  sidebar?.classList.toggle('mobile-open');
  overlay?.classList.toggle('open');
  btn?.classList.toggle('open');
  btn?.setAttribute('aria-expanded', String(!isOpen));
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

function closeMobileSidebar() {
  document.querySelector('.app-sidebar')?.classList.remove('mobile-open');
  document.querySelector('.sidebar-mobile-overlay')?.classList.remove('open');
  document.querySelector('.app-hamburger')?.classList.remove('open');
  document.querySelector('.app-hamburger')?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

// Cerrar sidebar al navegar (click en link del sidebar en móvil)
document.addEventListener('click', e => {
  if (window.innerWidth > 768) return;
  if (e.target.closest('.sidebar-nav-link')) closeMobileSidebar();
});

/* ═══════════════════════════════════════════════════════════
   GLOBAL ERROR BOUNDARY
   Captura errores silenciosos y los muestra como toast.
   Evita que la app quede rota sin aviso al usuario.
   ═══════════════════════════════════════════════════════════ */
(function initGlobalErrorBoundary() {
  // Errores síncronos no capturados
  window.onerror = function(message, source, lineno, colno, error) {
    const msg = error?.message || message || 'Error inesperado';
    // Ignorar errores de extensiones de browser (chrome-extension://, moz-extension://)
    if (source && (source.includes('extension') || source.includes('safari-extension'))) return false;
    // Ignorar errores de terceros (fonts, cdn) que no son nuestros
    if (source && !source.includes(window.location.hostname) && !source.includes('localhost') && !source.includes('127.0.0.1')) return false;
    console.error('[MTX] Uncaught error:', msg, { source, lineno, colno });
    showToast(`Error: ${msg.slice(0, 120)}`, 'error');
    // Log al servidor si tenemos usuario autenticado
    if (window._mtxCurrentUser) {
      logSecurityEvent('js_error', { message: msg.slice(0, 500), source, lineno });
    }
    return false; // No suprimir stack en console
  };

  // Promesas rechazadas sin catch
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason) || 'Promesa rechazada';
    // Ignorar errores de red típicos (offline, timeout) — se muestran en la operación
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('Load failed')) return;
    console.error('[MTX] Unhandled rejection:', msg);
    showToast(`Error de operación: ${msg.slice(0, 120)}`, 'error');
    if (window._mtxCurrentUser) {
      logSecurityEvent('promise_rejection', { message: msg.slice(0, 500) });
    }
  });
})();

/* ═══════════════════════════════════════════════════════════
   RETRY CON BACKOFF EXPONENCIAL
   Uso: await fetchWithRetry(fn, { retries: 3, baseDelay: 500 })
   fn = función async que devuelve data o lanza error
   ═══════════════════════════════════════════════════════════ */
async function fetchWithRetry(fn, opts = {}) {
  const { retries = 3, baseDelay = 400, maxDelay = 8000, onRetry } = opts;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      // No reintentar errores de autenticación/autorización
      const status = err?.status || err?.statusCode || 0;
      if (status === 401 || status === 403 || status === 422) throw err;
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 200, maxDelay);
      console.warn(`[MTX] Retry ${attempt + 1}/${retries} en ${Math.round(delay)}ms —`, err?.message || err);
      if (onRetry) onRetry(attempt + 1, delay);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/* Wrapper para llamadas Supabase con retry automático */
async function supabaseQuery(queryFn, opts = {}) {
  return fetchWithRetry(async () => {
    const result = await queryFn();
    if (result.error) {
      const err = new Error(result.error.message || 'Supabase error');
      err.status = result.error.status || result.error.code;
      throw err;
    }
    return result.data;
  }, { retries: 2, baseDelay: 500, ...opts });
}

/* ── Run security + mobile init on every page ─────────── */
document.addEventListener('DOMContentLoaded', () => {
  injectSecurityHeaders();
  initSessionTimeout();
  initSecurityMonitor();
  // Mobile sidebar se inicia DESPUÉS de que renderHeader() inserta el sidebar
  // Se llama desde renderHeader vía observer o desde cada página individualmente
  setTimeout(initMobileSidebar, 100);
});
