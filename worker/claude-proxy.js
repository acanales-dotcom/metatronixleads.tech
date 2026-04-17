/* ============================================================
   METATRONIXLEADS.TECH — Cloudflare Worker: Claude API Proxy
   v2.0 — JWT auth, rate limiting, model allowlist, cost cap
   ============================================================
   Secrets requeridos en el Worker (Settings → Variables):
     ANTHROPIC_API_KEY   — tu API key de Anthropic
     SUPABASE_JWT_SECRET — Project → Settings → API → JWT Secret
     PERPLEXITY_API_KEY  — opcional
   ============================================================ */

const ALLOWED_ORIGINS = [
  'https://metatronixleads.tech',
  'https://www.metatronixleads.tech',
  'https://acanales-dotcom.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
];

const ALLOWED_MODELS = new Set([
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5',
  'claude-sonnet-4-6',
]);

const MAX_TOKENS_CAP = 4096;
const SUPABASE_URL   = 'https://hodrfonbpmqulkyzrzpq.supabase.co';

/* ── Rate limiter en memoria (por IP, 60 req/min) ─────────── */
const _rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now(), window = 60_000, max = 60;
  const key  = ip || 'anon';
  let hits   = (_rateMap.get(key) || []).filter(t => now - t < window);
  if (hits.length >= max) return true;
  hits.push(now);
  _rateMap.set(key, hits);
  if (_rateMap.size > 5000) {
    for (const [k,v] of _rateMap) if (v.every(t => now-t > window)) _rateMap.delete(k);
  }
  return false;
}

/* ── Verificación de JWT Supabase con Web Crypto ──────────── */
async function verifySupabaseJWT(token, secret) {
  try {
    if (!token || !secret) return null;
    const [hb64, pb64, sb64] = token.split('.');
    if (!hb64 || !pb64 || !sb64) return null;
    const sigBytes  = Uint8Array.from(atob(sb64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(`${hb64}.${pb64}`);
    const key       = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name:'HMAC', hash:'SHA-256' }, false, ['verify']
    );
    if (!await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes)) return null;
    const payload = JSON.parse(atob(pb64.replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch (_) { return null; }
}

function corsH(origin) {
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':   o,
    'Access-Control-Allow-Methods':  'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':  'Content-Type, Authorization, apikey, X-Client-Info, X-Supabase-Api-Version, Prefer, Range, Accept',
    'Access-Control-Expose-Headers': 'Content-Range, X-Content-Range',
    'Access-Control-Max-Age':        '86400',
  };
}
const jsonErr = (msg, status, origin) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { ...corsH(origin), 'Content-Type': 'application/json' },
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);
    const ip     = request.headers.get('CF-Connecting-IP') || '';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH(origin) });
    if (isRateLimited(ip)) return jsonErr('Demasiadas solicitudes — espera un momento.', 429, origin);

    /* ── Proxy Supabase (/supabase/*) ──────────────────────── */
    if (url.pathname.startsWith('/supabase')) {
      const target = SUPABASE_URL + url.pathname.replace(/^\/supabase/,'') + url.search;
      const fwd    = new Headers();
      for (const [k,v] of request.headers) {
        if (['host','origin','referer'].includes(k.toLowerCase())) continue;
        fwd.set(k, v);
      }
      try {
        const r = await fetch(target, {
          method:  request.method,
          headers: fwd,
          body:    ['GET','HEAD'].includes(request.method) ? undefined : request.body,
        });
        const rh = new Headers(corsH(origin));
        for (const h of ['content-type','content-range','x-content-range','etag','cache-control']) {
          const v = r.headers.get(h); if (v) rh.set(h, v);
        }
        return new Response(r.body, { status: r.status, headers: rh });
      } catch (e) { return jsonErr('Supabase proxy error: ' + e.message, 502, origin); }
    }

    if (request.method !== 'POST') return jsonErr('Method Not Allowed', 405, origin);

    /* ── Auth JWT (si SUPABASE_JWT_SECRET está configurado) ── */
    if (env.SUPABASE_JWT_SECRET) {
      const auth  = request.headers.get('Authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!await verifySupabaseJWT(token, env.SUPABASE_JWT_SECRET)) {
        return jsonErr('Sesión inválida o expirada — inicia sesión de nuevo.', 401, origin);
      }
    }

    /* ── Perplexity (/perplexity) ───────────────────────────── */
    if (url.pathname === '/perplexity') {
      if (!env.PERPLEXITY_API_KEY) return jsonErr('PERPLEXITY_API_KEY no configurada', 500, origin);
      try {
        const body = await request.json();
        const r    = await fetch('https://api.perplexity.ai/chat/completions', {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        if (!r.ok) return jsonErr(`Perplexity ${r.status}`, r.status, origin);
        return new Response(r.body, {
          status:  200,
          headers: { ...corsH(origin), 'Content-Type': r.headers.get('content-type')||'application/json', 'Cache-Control':'no-cache', 'X-Accel-Buffering':'no' },
        });
      } catch (e) { return jsonErr(e.message, 500, origin); }
    }

    /* ── Claude (ruta raíz /) ───────────────────────────────── */
    if (!env.ANTHROPIC_API_KEY) return jsonErr('ANTHROPIC_API_KEY no configurada', 500, origin);

    try {
      const body  = await request.json();
      const model = body.model || 'claude-haiku-4-5-20251001';
      if (!ALLOWED_MODELS.has(model)) return jsonErr(`Modelo no permitido: ${model}`, 400, origin);

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body:    JSON.stringify({
          model,
          max_tokens: Math.min(body.max_tokens || 1500, MAX_TOKENS_CAP),
          system:     body.system || `Eres asistente experto de MetaTronix / IBANOR SA de CV. Responde en español, estructurado. Fecha: ${new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}.`,
          messages:   body.messages,
          stream:     true,
        }),
      });

      if (!r.ok) {
        const e = await r.text();
        return jsonErr(`Claude ${r.status}: ${e.slice(0,200)}`, r.status, origin);
      }

      return new Response(r.body, {
        status:  200,
        headers: { ...corsH(origin), 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'X-Accel-Buffering':'no' },
      });
    } catch (e) { return jsonErr(e.message, 500, origin); }
  },
};
