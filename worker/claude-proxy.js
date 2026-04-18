// ============================================================
// METATRONIXLEADS.TECH — Cloudflare Worker: Claude + HF Proxy
// v3.0 — JWT verification + rate limiting + HuggingFace proxy
// ============================================================
// Secrets requeridos en Workers dashboard:
//   ANTHROPIC_API_KEY  → tu Anthropic API key
//   HF_API_KEY         → tu HuggingFace Access Token (hf_xxx)
//   SUPABASE_URL       → https://hodrfonbpmqulkyzrzpq.supabase.co
//   SUPABASE_ANON_KEY  → tu Supabase anon key
//
// Rutas:
//   POST /        → Claude API proxy (streaming SSE)
//   POST /hf      → HuggingFace Inference API proxy (imagen/video)
// ============================================================

const ALLOWED_ORIGINS = [
  'https://metatronixleads.tech',
  'https://www.metatronixleads.tech',
  'https://acanales-dotcom.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
];

// Modelos HF permitidos (whitelist de seguridad)
const HF_ALLOWED_MODELS = [
  'black-forest-labs/FLUX.1-dev',        // imágenes HD — requiere HF Pro
  'black-forest-labs/FLUX.1-schnell',    // imágenes rápidas — tier gratuito
  'Wan-AI/Wan2.1-T2V-1.3B',             // video — requiere HF Pro
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

/* ── Verificar JWT y retornar usuario o respuesta de error ──── */
async function requireAuth(request, env, origin) {
  const authHeader = request.headers.get('Authorization') || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!jwt) return { user: null, err: jsonResp({ error: 'No autorizado. Inicia sesión.' }, 401, origin) };

  let user = null;
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    user = await verifySupabaseJWT(jwt, env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
  if (!user) return { user: null, err: jsonResp({ error: 'Token inválido o expirado.' }, 401, origin) };
  return { user, err: null };
}

/* ═══════════════════════════════════════════════════════════
   HANDLER: HuggingFace Inference API Proxy
   Ruta: POST /hf
   Body: { model: string, inputs: string, parameters: object }
   ═══════════════════════════════════════════════════════════ */
async function handleHF(request, env, origin) {
  if (!env.HF_API_KEY) {
    return jsonResp({ error: 'HF_API_KEY no configurada en el Worker. Agrégala en Cloudflare Workers → Settings → Variables.' }, 500, origin);
  }

  const { user, err } = await requireAuth(request, env, origin);
  if (err) return err;

  if (!checkRateLimit(user.id + '_hf')) {
    return jsonResp({
      error: `Límite de velocidad alcanzado (${RATE_LIMIT_MAX} requests/min). Espera un momento.`,
    }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp({ error: 'Body JSON inválido.' }, 400, origin);
  }

  const { model, inputs, parameters } = body;

  if (!model || !HF_ALLOWED_MODELS.includes(model)) {
    return jsonResp({
      error: `Modelo no permitido: ${model}. Modelos válidos: ${HF_ALLOWED_MODELS.join(', ')}`,
    }, 400, origin);
  }

  if (!inputs || typeof inputs !== 'string' || inputs.trim().length < 3) {
    return jsonResp({ error: 'inputs requerido (prompt de texto mínimo 3 chars).' }, 400, origin);
  }

  try {
    const hfResp = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization':    `Bearer ${env.HF_API_KEY}`,
          'Content-Type':     'application/json',
          'X-Wait-For-Model': 'true',
        },
        body: JSON.stringify({ inputs: inputs.trim(), parameters: parameters || {} }),
        // No timeout en el Worker — el cliente ya pone AbortSignal
      }
    );

    if (!hfResp.ok) {
      // Intentar leer JSON de error de HF, sino texto plano
      let errMsg = `HuggingFace error ${hfResp.status}`;
      try {
        const errBody = await hfResp.json();
        errMsg = errBody.error || errBody.message || errMsg;
      } catch {
        try { errMsg = await hfResp.text(); } catch { /* noop */ }
      }
      return jsonResp({ error: errMsg, status: hfResp.status }, hfResp.status, origin);
    }

    // Pasar la respuesta binaria (imagen PNG/JPEG o video MP4) directo al cliente
    const contentType = hfResp.headers.get('content-type') || 'application/octet-stream';
    return new Response(hfResp.body, {
      status: 200,
      headers: {
        ...corsHeaders(origin),
        ...SECURITY_HEADERS,
        'Content-Type': contentType,
      },
    });

  } catch (e) {
    return jsonResp({ error: e.message || 'Error interno proxying HuggingFace.' }, 500, origin);
  }
}

/* ═══════════════════════════════════════════════════════════
   HANDLER: Claude API Proxy
   Ruta: POST /  (cualquier path que no sea /hf)
   ═══════════════════════════════════════════════════════════ */
async function handleClaude(request, env, origin) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResp({ error: 'ANTHROPIC_API_KEY no configurada en el Worker' }, 500, origin);
  }

  const { user, err } = await requireAuth(request, env, origin);
  if (err) return err;

  if (!checkRateLimit(user.id)) {
    return jsonResp({
      error: `Límite de velocidad alcanzado (${RATE_LIMIT_MAX} llamadas/min). Espera un momento.`,
    }, 429, origin);
  }

  try {
    const body = await request.json();

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
      const errText = await claudeRes.text();
      return jsonResp({ error: `Claude API error ${claudeRes.status}: ${errText}` }, claudeRes.status, origin);
    }

    return new Response(claudeRes.body, {
      status: 200,
      headers: {
        ...corsHeaders(origin),
        ...SECURITY_HEADERS,
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'X-Accel-Buffering': 'no',
        'X-User-Id':         user.id,
      },
    });

  } catch (err) {
    return jsonResp({ error: err.message || 'Error interno del servidor' }, 500, origin);
  }
}

/* ═══════════════════════════════════════════════════════════
   HANDLER: Groq LLM Proxy (OpenAI-compat → Anthropic SSE)
   Ruta: POST /groq
   Body: { model, messages, max_tokens, system, stream }
   Modelos soportados: llama-3.3-70b-versatile, llama-3.1-8b-instant
   Secret requerido: GROQ_API_KEY
   ═══════════════════════════════════════════════════════════ */
const GROQ_ALLOWED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

async function handleGroq(request, env, origin) {
  if (!env.GROQ_API_KEY) {
    return jsonResp({ error: 'GROQ_API_KEY no configurada en el Worker. Agrégala en Cloudflare Workers → Settings → Variables.' }, 500, origin);
  }

  const { user, err } = await requireAuth(request, env, origin);
  if (err) return err;

  if (!checkRateLimit(user.id + '_groq')) {
    return jsonResp({ error: `Límite de velocidad alcanzado (${RATE_LIMIT_MAX} requests/min).` }, 429, origin);
  }

  let body;
  try { body = await request.json(); } catch {
    return jsonResp({ error: 'Body JSON inválido.' }, 400, origin);
  }

  const model = body.model || 'llama-3.3-70b-versatile';
  if (!GROQ_ALLOWED_MODELS.includes(model)) {
    return jsonResp({ error: `Modelo Groq no permitido: ${model}. Válidos: ${GROQ_ALLOWED_MODELS.join(', ')}` }, 400, origin);
  }

  // Construir mensajes: si hay system prompt, añadir como primer mensaje
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: body.system });
  (body.messages || []).forEach(m => messages.push(m));

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens:  body.max_tokens  || 2048,
        temperature: body.temperature || 0.7,
        stream:      true,
      }),
    });

    if (!groqRes.ok) {
      let errMsg = `Groq error ${groqRes.status}`;
      try { const j = await groqRes.json(); errMsg = j.error?.message || errMsg; } catch {}
      return jsonResp({ error: errMsg }, groqRes.status, origin);
    }

    /* ── Traducir SSE OpenAI → SSE Anthropic ──────────────────
       Groq emite: data: {"choices":[{"delta":{"content":"txt"}}]}
       Frontend espera: data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"txt"}}
       ────────────────────────────────────────────────────────── */
    const { readable, writable } = new TransformStream();
    const writer  = writable.getWriter();
    const enc     = new TextEncoder();
    const dec     = new TextDecoder();

    (async () => {
      const reader = groqRes.body.getReader();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              await writer.write(enc.encode('data: [DONE]\n\n'));
              return;
            }
            try {
              const chunk = JSON.parse(data);
              const text  = chunk.choices?.[0]?.delta?.content;
              if (text) {
                const ev = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } };
                await writer.write(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
              }
            } catch { /* noop */ }
          }
        }
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        ...corsHeaders(origin),
        ...SECURITY_HEADERS,
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'X-Accel-Buffering': 'no',
        'X-Model':           model,
      },
    });

  } catch (e) {
    return jsonResp({ error: e.message || 'Error interno Groq proxy.' }, 500, origin);
  }
}

/* ═══════════════════════════════════════════════════════════
   ROUTER PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
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

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/hf')   return handleHF(request, env, origin);
    if (path === '/groq') return handleGroq(request, env, origin);

    return handleClaude(request, env, origin);
  },
};
