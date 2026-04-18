// ============================================================
// METATRONIXLEADS.TECH — Cloudflare Worker: Claude API Proxy
// v2.1 — JWT verification + rate limiting + security headers
// ============================================================
// Secrets requeridos en Workers dashboard:
//   ANTHROPIC_API_KEY  → tu Anthropic API key
//   SUPABASE_URL       → https://hodrfonbpmqulkyzrzpq.supabase.co
//   SUPABASE_ANON_KEY  → tu Supabase anon key
// ============================================================

const ALLOWED_ORIGINS = [
  'https://metatronixleads.tech',
  'https://www.metatronixleads.tech',
  'https://acanales-dotcom.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
];

/* ── Security headers agregados a TODAS las respuestas ─────── */
const SECURITY_HEADERS = {
  'X-Content-Type-Options':  'nosniff',
  'X-Frame-Options':          'DENY',
  'X-XSS-Protection':         '1; mode=block',
  'Referrer-Policy':          'strict-origin-when-cross-origin',
  'Permissions-Policy':       'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains; preload',
};

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

function jsonResp(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

/* ── JWT verification via Supabase auth endpoint ───────────── */
async function verifySupabaseJWT(token, supabaseUrl, supabaseAnonKey) {
  if (!token || !supabaseUrl || !supabaseAnonKey) return null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey':        supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return await res.json(); // { id, email, ... }
  } catch {
    return null;
  }
}

/* ── In-memory rate limiter (por user_id, ventana deslizante) ─
   Nota: se reinicia en cold starts del Worker. Para persistencia
   entre instancias se requiere Workers KV.
   ──────────────────────────────────────────────────────────── */
const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_MAX    = 30;     // llamadas máximas por usuario
const RATE_LIMIT_WINDOW = 60_000; // ventana de 1 minuto (ms)

function checkRateLimit(userId) {
  const now  = Date.now();
  const key  = userId || 'anonymous';
  const prev = (RATE_LIMIT_MAP.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (prev.length >= RATE_LIMIT_MAX) return false;
  RATE_LIMIT_MAP.set(key, [...prev, now]);
  return true;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // ── Preflight CORS ──────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(origin), ...SECURITY_HEADERS },
      });
    }

    // ── Solo POST ───────────────────────────────────────────
    if (request.method !== 'POST') {
      return jsonResp({ error: 'Method Not Allowed' }, 405, origin);
    }

    // ── Verificar ANTHROPIC_API_KEY configurada ─────────────
    if (!env.ANTHROPIC_API_KEY) {
      return jsonResp({ error: 'ANTHROPIC_API_KEY no configurada en el Worker' }, 500, origin);
    }

    // ── Verificar JWT de Supabase ───────────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    let authenticatedUser = null;
    if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && jwt) {
      authenticatedUser = await verifySupabaseJWT(jwt, env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    }

    // Rechazar si no hay JWT válido (protección de créditos)
    if (!authenticatedUser) {
      return jsonResp({ error: 'No autorizado. Inicia sesión para usar esta función.' }, 401, origin);
    }

    // ── Rate limiting por usuario ───────────────────────────
    if (!checkRateLimit(authenticatedUser.id)) {
      return jsonResp({
        error: `Límite de velocidad alcanzado (${RATE_LIMIT_MAX} llamadas/min). Espera un momento.`,
      }, 429, origin);
    }

    try {
      const body = await request.json();

      // ── Llamar a Claude API (streaming SSE) ────────────────
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      body.model      || 'claude-haiku-4-5-20251001',
          max_tokens: body.max_tokens || 4096,
          system:     body.system     || `Eres un redactor experto de documentos empresariales para IBANOR SA de CV / MetaTronix. Genera documentos en español, estructurados y profesionales. Devuelve SOLO HTML semántico (h1-h3, p, ul, ol, table, strong, em). NO incluyas DOCTYPE, html, head, body ni style tags. Incluye fecha actual: ${new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' })}.`,
          messages:   body.messages,
          stream:     true,
        }),
      });

      if (!claudeRes.ok) {
        const err = await claudeRes.text();
        return jsonResp({ error: `Claude API error ${claudeRes.status}: ${err}` }, claudeRes.status, origin);
      }

      // ── Pasar el stream SSE directo al cliente ──────────────
      return new Response(claudeRes.body, {
        status: 200,
        headers: {
          ...corsHeaders(origin),
          ...SECURITY_HEADERS,
          'Content-Type':      'text/event-stream',
          'Cache-Control':     'no-cache',
          'X-Accel-Buffering': 'no',
          'X-User-Id':         authenticatedUser.id, // debug header
        },
      });

    } catch (err) {
      return jsonResp({ error: err.message || 'Error interno del servidor' }, 500, origin);
    }
  },
};
