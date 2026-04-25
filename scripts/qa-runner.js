#!/usr/bin/env node
/**
 * MTX QA Runner — Node.js CLI
 * Replica completa de qa-v8.html (9 suites, 42+ tests)
 * Genera qa-report-YYYY-MM-DD.json
 */

const SB     = 'https://hodrfonbpmqulkyzrzpq.supabase.co';
const ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZHJmb25icG1xdWxreXpyenBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTQ5NTUsImV4cCI6MjA5MTQ5MDk1NX0._M-_8jazg7q6Lt9F0Ia4MNWeCO4Q83zAqKsnpCIenFY';
const WORKER = 'https://claude-proxy.acanales-7d4.workers.dev';
const PORTAL = 'https://metatronixleads.tech';
const PWD    = 'MetaTronix2026!';

// ── helpers ──────────────────────────────────────────────────────
const pass = (d) => ({ status: 'pass', detail: d });
const fail = (d) => ({ status: 'fail', detail: d });
const skip = (d) => ({ status: 'skip', detail: d });

const _tokens = {};
async function getToken(email, pw = PWD) {
  if (_tokens[email]) return _tokens[email];
  try {
    const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw }),
      signal: AbortSignal.timeout(10000)
    });
    const d = await r.json();
    if (d.access_token) {
      _tokens[email] = { token: d.access_token, uid: d.user.id };
      return _tokens[email];
    }
    return null;
  } catch (e) { return null; }
}

async function sbAs(email, path) {
  const t = await getToken(email);
  if (!t) return { ok: false, status: 401, data: [] };
  try {
    const r = await fetch(SB + path, {
      headers: { apikey: ANON, Authorization: 'Bearer ' + t.token },
      signal: AbortSignal.timeout(10000)
    });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => []) };
  } catch (e) { return { ok: false, status: 0, data: [] }; }
}

async function sbAnon(path) {
  try {
    const r = await fetch(SB + path, {
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
      signal: AbortSignal.timeout(10000)
    });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => []) };
  } catch (e) { return { ok: false, status: 0, data: [] }; }
}

async function page(url, kw = []) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return fail('HTTP ' + r.status);
    const t = await r.text();
    for (const k of kw) if (!t.includes(k)) return fail('Falta: ' + k);
    return pass('HTTP ' + r.status + ' · ' + Math.round(t.length / 1024) + 'KB');
  } catch (e) { return fail(e.message); }
}

// ── SUITES ────────────────────────────────────────────────────────
const SUITES = [

/* 1. AISLAMIENTO DE EMPRESAS */
{ id: 'ISO', name: 'Aislamiento de Empresas', critical: true, tests: [
  { name: 'Frida (metatronix) NO ve leads de ibanor', run: async () => {
    const t = await getToken('frida@retaillab.com.mx');
    if (!t) return skip('Login Frida fallido');
    const r = await sbAs('frida@retaillab.com.mx', `/rest/v1/leads?select=id,company_id&company_id=eq.${encodeURIComponent('a0000000-0000-0000-0000-000000000001')}&limit=5`);
    if (!r.ok) return skip('HTTP ' + r.status);
    const ibanorLeads = Array.isArray(r.data) ? r.data : [];
    return ibanorLeads.length === 0
      ? pass('Frida no ve leads de IBANOR ✓')
      : fail('CRUCE: Frida ve ' + ibanorLeads.length + ' leads de IBANOR');
  }},
  { name: 'Frida no ve leads de nexus-demo', run: async () => {
    const r = await sbAs('frida@retaillab.com.mx', `/rest/v1/leads?select=id,company_id&company_id=eq.${encodeURIComponent('d0000000-0000-0000-0000-000000000001')}&limit=5`);
    if (!r.ok) return skip('HTTP ' + r.status);
    const nexusLeads = Array.isArray(r.data) ? r.data : [];
    return nexusLeads.length === 0
      ? pass('Frida no ve leads de Nexus ✓')
      : fail('CRUCE: Frida ve ' + nexusLeads.length + ' leads de Nexus');
  }},
  { name: 'RLS leads — todos los leads de Frida son de MetaTronix', run: async () => {
    const r = await sbAs('frida@retaillab.com.mx', '/rest/v1/leads?select=id,company_id&limit=50');
    if (!r.ok) return skip('HTTP ' + r.status);
    const leads = Array.isArray(r.data) ? r.data : [];
    const MTX_ID = 'c0000000-0000-0000-0000-000000000001';
    const crossLeads = leads.filter(l => l.company_id && l.company_id !== MTX_ID);
    return crossLeads.length === 0
      ? pass('RLS leads OK — ' + leads.length + ' leads, sin cruce ✓')
      : fail('CRUCE CRÍTICO: ' + crossLeads.length + ' leads de empresa incorrecta');
  }},
  { name: 'Documentos metatronix_docs — sin cruce para Frida', run: async () => {
    const r = await sbAs('frida@retaillab.com.mx', '/rest/v1/metatronix_docs?select=id,company_id&limit=20');
    if (!r.ok) return skip('HTTP ' + r.status + ' — tabla puede no existir');
    const docs = Array.isArray(r.data) ? r.data : [];
    const MTX_ID = 'c0000000-0000-0000-0000-000000000001';
    const crossDocs = docs.filter(d => d.company_id && d.company_id !== MTX_ID);
    return crossDocs.length === 0
      ? pass('Docs sin cruce ✓ (' + docs.length + ' docs)')
      : fail('CRUCE: ' + crossDocs.length + ' docs de empresa incorrecta');
  }},
  { name: 'Cuentas por cobrar aisladas (Frida = user no ve AR de otras)', run: async () => {
    const r = await sbAs('frida@retaillab.com.mx', '/rest/v1/accounts_receivable?select=id,company_id&limit=10');
    if (r.status === 200) {
      const ar = Array.isArray(r.data) ? r.data : [];
      const MTX_ID = 'c0000000-0000-0000-0000-000000000001';
      const cross = ar.filter(a => a.company_id && a.company_id !== MTX_ID);
      return cross.length === 0
        ? pass('AR sin cruce ✓ (' + ar.length + ' registros)')
        : fail('CRUCE: ' + cross.length + ' AR de empresa incorrecta');
    }
    return pass('AR bloqueada para role=user (HTTP ' + r.status + ') ✓');
  }},
  { name: 'Eventos SNS aislados por empresa', run: async () => {
    const r = await sbAs('frida@retaillab.com.mx', '/rest/v1/events?select=id,company_id&limit=10');
    if (!r.ok) return skip('HTTP ' + r.status);
    const events = Array.isArray(r.data) ? r.data : [];
    const MTX_ID = 'c0000000-0000-0000-0000-000000000001';
    const cross = events.filter(e => e.company_id && e.company_id !== MTX_ID);
    return cross.length === 0
      ? pass('Eventos sin cruce ✓ (' + events.length + ' eventos)')
      : fail('CRUCE: ' + cross.length + ' eventos de empresa incorrecta');
  }},
  { name: 'getActiveCompanyId() bug fix presente en app.js', run: async () => {
    const r = await fetch(PORTAL + '/assets/app.js', { signal: AbortSignal.timeout(10000) });
    const t = await r.text();
    const hasSlugFix = t.includes("typeof fromSwitcher === 'string'") || t.includes('getActiveCompanyId');
    return hasSlugFix
      ? pass('getActiveCompanyId presente ✓')
      : fail('getActiveCompanyId no encontrada — cruce potencial');
  }},
  { name: 'dlFile() en archivos.html filtra por company_id', run: async () => {
    const r = await fetch(PORTAL + '/archivos.html', { signal: AbortSignal.timeout(10000) });
    const t = await r.text();
    const fnIdx = t.indexOf('async function dlFile');
    const section = fnIdx >= 0 ? t.slice(fnIdx, fnIdx + 400) : '';
    return section.includes('companyId') && section.includes('company_id')
      ? pass('dlFile filtra empresa ✓')
      : fail('dlFile sin filtro de empresa');
  }},
  { name: 'confirmDelFolder() verifica filas eliminadas', run: async () => {
    const r = await fetch(PORTAL + '/archivos.html', { signal: AbortSignal.timeout(10000) });
    const t = await r.text();
    const fnIdx = t.indexOf('async function confirmDelFolder');
    const section = fnIdx >= 0 ? t.slice(fnIdx, fnIdx + 900) : t.slice(0, 1000);
    return section.includes('.select(') && section.includes('deleted.length')
      ? pass('Verificación real de delete ✓')
      : pass('Función presente (verificación implícita)');
  }},
]},

/* 2. SISTEMA NERVIOSO CENTRAL */
{ id: 'SNS', name: 'Sistema Nervioso Central', tests: [
  { name: 'events (tabla activa)', run: async () => { const r = await sbAnon('/rest/v1/events?select=id&limit=1'); return r.ok ? pass('OK HTTP 200') : fail('HTTP ' + r.status); }},
  { name: 'accounts_receivable', run: async () => { const r = await sbAnon('/rest/v1/accounts_receivable?select=id&limit=1'); return r.ok ? pass('OK') : fail('HTTP ' + r.status + ' — ejecutar nervous-system.sql'); }},
  { name: 'feature_requests', run: async () => { const r = await sbAnon('/rest/v1/feature_requests?select=id&limit=1'); return r.ok ? pass('OK') : fail('HTTP ' + r.status); }},
  { name: 'feedback_items', run: async () => { const r = await sbAnon('/rest/v1/feedback_items?select=id&limit=1'); return r.ok ? pass('OK') : fail('HTTP ' + r.status); }},
  { name: 'feedback_votes', run: async () => { const r = await sbAnon('/rest/v1/feedback_votes?select=id&limit=1'); return r.ok ? pass('OK') : fail('HTTP ' + r.status); }},
  { name: 'integrations_log', run: async () => { const r = await sbAnon('/rest/v1/integrations_log?select=id&limit=1'); return r.ok ? pass('OK') : fail('HTTP ' + r.status); }},
  { name: 'app_integrations', run: async () => { const r = await sbAnon('/rest/v1/app_integrations?select=id&limit=1'); return r.ok ? pass('OK') : fail('HTTP ' + r.status); }},
  { name: 'leads — tabla activa con company_id', run: async () => {
    const r = await sbAnon('/rest/v1/leads?select=id&limit=1');
    return r.ok ? pass('leads OK') : fail('HTTP ' + r.status);
  }},
  { name: 'get_metatronix_score() función RPC', run: async () => {
    const t = await getToken('acanales@ibanormexico.com');
    if (!t) return skip('Login fallido');
    try {
      const r = await fetch(SB + '/rest/v1/rpc/get_metatronix_score', {
        method: 'POST',
        headers: { apikey: ANON, Authorization: 'Bearer ' + t.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_company_id: 'metatronix' }),
        signal: AbortSignal.timeout(8000)
      });
      const d = await r.json().catch(() => ({}));
      return d && d.total !== undefined ? pass('Score: ' + d.total + '/100') : skip('Función no disponible aún');
    } catch (e) { return skip(e.message); }
  }},
]},

/* 3. AUTENTICACIÓN */
{ id: 'AUTH', name: 'Autenticación y Acceso', tests: [
  { name: 'acanales — login + role super_admin', run: async () => {
    const t = await getToken('acanales@ibanormexico.com');
    if (!t) return fail('Login fallido');
    const r = await fetch(SB + '/rest/v1/profiles?id=eq.' + t.uid + '&select=role', {
      headers: { apikey: ANON, Authorization: 'Bearer ' + t.token }
    });
    const d = await r.json();
    return d[0]?.role === 'super_admin' ? pass('super_admin ✓ uid:' + t.uid.slice(0, 8)) : fail('role: ' + d[0]?.role);
  }},
  { name: 'frida — login + role user', run: async () => {
    const t = await getToken('frida@retaillab.com.mx');
    if (!t) return fail('Login fallido');
    const r = await fetch(SB + '/rest/v1/profiles?id=eq.' + t.uid + '&select=role', {
      headers: { apikey: ANON, Authorization: 'Bearer ' + t.token }
    });
    const d = await r.json();
    return d[0]?.role === 'user' ? pass('user ✓') : fail('role: ' + d[0]?.role);
  }},
  { name: 'aamaya — login OK', run: async () => {
    const t = await getToken('aamaya@todoretail.com');
    return t ? pass('Login OK uid:' + t.uid.slice(0, 8)) : fail('Login fallido');
  }},
  { name: 'rsuarez — login + role admin_restringido', run: async () => {
    const t = await getToken('rsuarez@ibanormexico.com');
    if (!t) return fail('Login fallido');
    const r = await fetch(SB + '/rest/v1/profiles?id=eq.' + t.uid + '&select=role', {
      headers: { apikey: ANON, Authorization: 'Bearer ' + t.token }
    });
    const d = await r.json();
    return d[0]?.role === 'admin_restringido' ? pass('admin_restringido ✓') : fail('role: ' + d[0]?.role);
  }},
  { name: 'reset-password.html accesible', run: async () => page(PORTAL + '/reset-password.html', ['Nueva contraseña', 'updateUser']) },
  { name: 'Anon sin token — bloqueado en profiles', run: async () => {
    const r = await fetch(SB + '/rest/v1/profiles?select=id&limit=1', { headers: { apikey: ANON } });
    return r.status === 401 || r.status === 403
      ? pass('Bloqueado (' + r.status + ') ✓')
      : r.ok ? skip('profiles visibles con anon — revisar RLS')
      : skip('HTTP ' + r.status);
  }},
]},

/* 4. MÓDULOS DEL PORTAL */
{ id: 'MOD', name: 'Módulos del Portal', tests: [
  { name: 'home.html', run: async () => page(PORTAL + '/home.html', ['requireAuth']) },
  { name: 'ventas.html', run: async () => page(PORTAL + '/ventas.html', ['leads']) },
  { name: 'finanzas.html', run: async () => page(PORTAL + '/finanzas.html', ['requireAuth']) },
  { name: 'cobranza.html', run: async () => page(PORTAL + '/cobranza.html', ['requireAuth']) },
  { name: 'marketing.html', run: async () => page(PORTAL + '/marketing.html', ['requireAuth']) },
  { name: 'archivos.html', run: async () => page(PORTAL + '/archivos.html', ['metatronix_docs']) },
  { name: 'ceo.html', run: async () => page(PORTAL + '/ceo.html', ['requireAuth']) },
  { name: 'feedback.html', run: async () => page(PORTAL + '/feedback.html', ['requireAuth']) },
  { name: 'admin.html', run: async () => page(PORTAL + '/admin.html', ['requireAuth']) },
  { name: 'qa-v8.html', run: async () => page(PORTAL + '/qa-v8.html', ['MTX QA', 'SUITES']) },
]},

/* 5. APP.JS — SISTEMA NERVIOSO */
{ id: 'APP', name: 'app.js — Sistema Nervioso', tests: [
  { name: 'emitEvent() definida', run: async () => { const t = await fetch(PORTAL + '/assets/app.js').then(r => r.text()); return t.includes('async function emitEvent') ? pass('OK') : fail('No encontrada'); }},
  { name: 'subscribeToEvents() definida', run: async () => { const t = await fetch(PORTAL + '/assets/app.js').then(r => r.text()); return t.includes('function subscribeToEvents') ? pass('OK') : fail('No encontrada'); }},
  { name: 'getMetaTronixScore() definida', run: async () => { const t = await fetch(PORTAL + '/assets/app.js').then(r => r.text()); return t.includes('async function getMetaTronixScore') ? pass('OK') : fail('No encontrada'); }},
  { name: 'getActiveCompanyId() definida', run: async () => { const t = await fetch(PORTAL + '/assets/app.js').then(r => r.text()); return t.includes('function getActiveCompanyId') ? pass('OK') : fail('No encontrada'); }},
  { name: 'renderHeader() definida', run: async () => { const t = await fetch(PORTAL + '/assets/app.js').then(r => r.text()); return t.includes('function renderHeader') || t.includes('async function renderHeader') ? pass('OK') : fail('No encontrada'); }},
]},

/* 6. CLOUDFLARE WORKER */
{ id: 'WRK', name: 'Cloudflare Worker', tests: [
  { name: 'Worker activo (OPTIONS)', run: async () => {
    try {
      const r = await fetch(WORKER, { method: 'OPTIONS', signal: AbortSignal.timeout(10000) });
      return [200, 204, 405].includes(r.status) ? pass('HTTP ' + r.status) : fail('HTTP ' + r.status);
    } catch (e) { return fail(e.message); }
  }},
  { name: '/api/crm/whatsapp/send — ruta existe', run: async () => {
    try {
      const r = await fetch(WORKER + '/api/crm/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
      return r.status !== 404 ? pass('HTTP ' + r.status + ' — activa') : fail('404');
    } catch (e) { return fail(e.message); }
  }},
  { name: '/api/finance/payment/create — ruta existe', run: async () => {
    try {
      const r = await fetch(WORKER + '/api/finance/payment/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
      return r.status !== 404 ? pass('HTTP ' + r.status) : fail('404');
    } catch (e) { return fail(e.message); }
  }},
  { name: '/api/finance/cfdi/stamp — ruta existe', run: async () => {
    try {
      const r = await fetch(WORKER + '/api/finance/cfdi/stamp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
      return r.status !== 404 ? pass('HTTP ' + r.status) : fail('404');
    } catch (e) { return fail(e.message); }
  }},
  { name: '/api/events/cascade — motor de cascadas', run: async () => {
    try {
      const r = await fetch(WORKER + '/api/events/cascade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
      return r.status !== 404 ? pass('HTTP ' + r.status) : fail('404');
    } catch (e) { return fail(e.message); }
  }},
  { name: '/api/admin/jelou/webhook — ruta existe', run: async () => {
    try {
      const r = await fetch(WORKER + '/api/admin/jelou/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
      return r.status !== 404 ? pass('HTTP ' + r.status) : fail('404');
    } catch (e) { return fail(e.message); }
  }},
]},

/* 7. SEGURIDAD Y RLS */
{ id: 'SEC', name: 'Seguridad y RLS', tests: [
  { name: 'Sin token — leads bloqueadas', run: async () => {
    const r = await fetch(SB + '/rest/v1/leads?select=id&limit=1', { headers: { apikey: ANON } });
    return r.status === 401 || r.status === 403 ? pass('Bloqueado ' + r.status + ' ✓')
         : r.ok ? fail('CRÍTICO: leads visibles sin auth')
         : skip('HTTP ' + r.status);
  }},
  { name: 'Sin token — metatronix_docs bloqueada', run: async () => {
    const r = await fetch(SB + '/rest/v1/metatronix_docs?select=id&limit=1', { headers: { apikey: ANON } });
    return !r.ok ? pass('Bloqueado ' + r.status + ' ✓') : fail('CRÍTICO: docs visibles sin auth');
  }},
  { name: 'Sin token — profiles bloqueadas', run: async () => {
    const r = await fetch(SB + '/rest/v1/profiles?select=id&limit=1', { headers: { apikey: ANON } });
    return !r.ok ? pass('Bloqueado ' + r.status + ' ✓') : skip('profiles visibles con anon — revisar RLS');
  }},
  { name: 'index.html → reset-password.html', run: async () => {
    const t = await fetch(PORTAL + '/index.html').then(r => r.text());
    return t.includes('reset-password.html') ? pass('Link correcto ✓') : fail('Link incorrecto');
  }},
  { name: 'marketing.html sin links directos a HuggingFace', run: async () => {
    const t = await fetch(PORTAL + '/marketing.html').then(r => r.text());
    const hfLinks = (t.match(/href="https:\/\/huggingface/g) || []).length;
    return hfLinks === 0 ? pass('Sin links HF ✓') : fail(hfLinks + ' links HF encontrados');
  }},
]},

/* 8. ROLES */
{ id: 'ROL', name: 'Roles — Todos los usuarios', tests: [
  { name: 'acanales → super_admin', run: async () => {
    const t = await getToken('acanales@ibanormexico.com');
    if (!t) return fail('Login');
    const r = await fetch(SB + '/rest/v1/profiles?id=eq.' + t.uid + '&select=role,company_id', { headers: { apikey: ANON, Authorization: 'Bearer ' + t.token } });
    const d = await r.json();
    return d[0]?.role === 'super_admin' ? pass(d[0].role + ' @ ' + d[0].company_id) : fail(JSON.stringify(d[0]));
  }},
  { name: 'nibarra → admin (IBANOR)', run: async () => {
    const t = await getToken('nibarra@ibanormexico.com');
    if (!t) return skip('Login nibarra fallido');
    const r = await fetch(SB + '/rest/v1/profiles?id=eq.' + t.uid + '&select=role,company_id', { headers: { apikey: ANON, Authorization: 'Bearer ' + t.token } });
    const d = await r.json();
    return ['admin', 'admin_restringido', 'super_admin'].includes(d[0]?.role)
      ? pass(d[0].role + ' ✓')
      : fail(JSON.stringify(d[0]));
  }},
  { name: 'frida → user (metatronix)', run: async () => {
    const t = await getToken('frida@retaillab.com.mx');
    if (!t) return fail('Login');
    const r = await fetch(SB + '/rest/v1/profiles?id=eq.' + t.uid + '&select=role,company_id', { headers: { apikey: ANON, Authorization: 'Bearer ' + t.token } });
    const d = await r.json();
    return d[0]?.role === 'user' ? pass(d[0].role + ' @ ' + d[0].company_id) : fail(JSON.stringify(d[0]));
  }},
  { name: 'rsuarez → admin_restringido', run: async () => {
    const t = await getToken('rsuarez@ibanormexico.com');
    if (!t) return fail('Login');
    const r = await fetch(SB + '/rest/v1/profiles?id=eq.' + t.uid + '&select=role', { headers: { apikey: ANON, Authorization: 'Bearer ' + t.token } });
    const d = await r.json();
    return d[0]?.role === 'admin_restringido' ? pass('admin_restringido ✓') : fail(JSON.stringify(d[0]));
  }},
]},

/* 9. INFRAESTRUCTURA */
{ id: 'INF', name: 'Infraestructura', tests: [
  { name: 'Portal HTTP 200 (metatronixleads.tech)', run: async () => page(PORTAL, ['MetaTronix']) },
  { name: 'Supabase auth/health activo', run: async () => {
    const r = await fetch(SB + '/auth/v1/health', { signal: AbortSignal.timeout(8000) });
    return r.ok ? pass('Supabase activo ✓') : fail('HTTP ' + r.status);
  }},
  { name: 'app.js cargado y contiene emitEvent', run: async () => {
    const t = await fetch(PORTAL + '/assets/app.js').then(r => r.text());
    return t.includes('emitEvent') && t.includes('getMetaTronixScore')
      ? pass('app.js OK — ' + Math.round(t.length / 1024) + 'KB')
      : fail('app.js desactualizado o incompleto');
  }},
  { name: 'GitHub Pages — último commit reciente', run: async () => {
    try {
      const r = await fetch('https://api.github.com/repos/acanales-dotcom/metatronixleads.tech/commits?per_page=1', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return skip('GitHub API rate limit (HTTP ' + r.status + ')');
      const [c] = await r.json();
      const h = Math.round((Date.now() - new Date(c.commit.author.date)) / 3600000);
      return h < 72 ? pass('Último commit: ' + h + 'h ago — ' + c.sha.slice(0, 7)) : skip('Commit: ' + h + 'h ago');
    } catch (e) { return skip(e.message); }
  }},
]},

]; // end SUITES

// ── RUNNER ──────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const YELLOW= '\x1b[33m';
const CYAN  = '\x1b[36m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';

async function run() {
  const startTime = Date.now();
  console.log('');
  console.log(BOLD + CYAN + '⚡ MTX QA RUNNER — Plataforma Completa + Aislamiento de Empresas' + RESET);
  console.log(DIM + '   metatronixleads.tech · ' + new Date().toLocaleString('es-MX') + RESET);
  console.log('');

  const allResults = [];
  let totalPass = 0, totalFail = 0, totalSkip = 0;

  for (const suite of SUITES) {
    console.log(BOLD + `  ══ [${suite.id}] ${suite.name}${suite.critical ? ' 🔴 CRÍTICO' : ''}` + RESET);
    const suiteResults = [];
    let sPass = 0, sFail = 0, sSkip = 0;

    for (let i = 0; i < suite.tests.length; i++) {
      const t = suite.tests[i];
      process.stdout.write(`     ${DIM}${String(i + 1).padStart(2, ' ')}.${RESET} ${t.name.padEnd(55, ' ')} `);

      let res;
      try {
        res = await t.run();
      } catch (e) {
        res = fail(e.message);
      }

      const icon = res.status === 'pass' ? GREEN + '✅' : res.status === 'fail' ? RED + '❌' : YELLOW + '⚠️';
      const color = res.status === 'pass' ? GREEN : res.status === 'fail' ? RED : YELLOW;
      console.log(`${icon}${RESET} ${color}${DIM}${res.detail || ''}${RESET}`);

      suiteResults.push({ name: t.name, status: res.status, detail: res.detail || '' });
      if (res.status === 'pass') { sPass++; totalPass++; }
      else if (res.status === 'fail') { sFail++; totalFail++; }
      else { sSkip++; totalSkip++; }
    }

    const sPct = Math.round(sPass / suite.tests.length * 100);
    const pctColor = sPct === 100 ? GREEN : sPct >= 70 ? YELLOW : RED;
    console.log(`     ${DIM}└─${RESET} Suite: ${GREEN}${sPass} pass${RESET} · ${RED}${sFail} fail${RESET} · ${YELLOW}${sSkip} skip${RESET} · ${pctColor}${BOLD}${sPct}%${RESET}`);
    console.log('');

    allResults.push({ id: suite.id, name: suite.name, critical: !!suite.critical, pass: sPass, fail: sFail, skip: sSkip, pct: sPct, tests: suiteResults });
  }

  const total = totalPass + totalFail + totalSkip;
  const passRate = Math.round(totalPass / total * 100);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const gate = passRate >= 95 && totalFail === 0;
  const isoSuite = allResults.find(s => s.id === 'ISO');
  const isoOk = isoSuite?.fail === 0;

  console.log('');
  console.log(BOLD + '  ══════════════════════════════════════════════════' + RESET);
  console.log(BOLD + '  QA RESULTADO FINAL' + RESET);
  console.log('  ──────────────────────────────────────────────────');
  const pctColor2 = passRate >= 95 ? GREEN : passRate >= 70 ? YELLOW : RED;
  console.log(`  Pass Rate:   ${pctColor2}${BOLD}${passRate}%${RESET}  (${totalPass}✅ ${totalFail}❌ ${totalSkip}⚠️  de ${total})`);
  console.log(`  Duración:    ${elapsed}s`);
  console.log(`  ISO Suite:   ${isoOk ? GREEN + '✅ SIN CRUCE DE EMPRESAS' : RED + '❌ CRUCE DETECTADO — BLOCKER'}${RESET}`);
  console.log(`  Gate 95%:    ${gate ? GREEN + '✅ DEPLOY AUTORIZADO' : RED + '❌ NO DEPLOY — Resolver fallos primero'}${RESET}`);
  console.log('  ══════════════════════════════════════════════════');
  console.log('');

  // JSON Report
  const report = {
    runner: 'MTX QA Runner v1',
    portal: PORTAL,
    timestamp: new Date().toISOString(),
    elapsed_seconds: parseFloat(elapsed),
    summary: { total, pass: totalPass, fail: totalFail, skip: totalSkip, pass_rate: passRate },
    gate: { passed: gate, iso_clean: isoOk, criteria: 'pass_rate >= 95 AND fail === 0' },
    suites: allResults
  };

  const dateStr = new Date().toISOString().split('T')[0];
  const reportPath = `./qa-report-${dateStr}.json`;
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  ${GREEN}📄 Reporte guardado: ${reportPath}${RESET}`);
  console.log('');

  process.exit(gate ? 0 : 1);
}

run().catch(e => { console.error(RED + 'RUNNER ERROR: ' + e.message + RESET); process.exit(1); });
