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
  return `
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
      <span class="user-name">${escHtml(name)}</span>
      ${isAdmin ? '<span class="badge badge-accent">Admin</span>' : ''}
      <button onclick="logout()" class="btn-ghost">Salir</button>
    </div>
  </header>`;
}
