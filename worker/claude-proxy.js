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
   HANDLER: CEO Nerve Center Query Router
   Ruta: POST /ceo-query
   Body: { question: string, pulse: object, query_type: string }
   Auth: Supabase JWT — solo admin / super_admin
   ═══════════════════════════════════════════════════════════ */
async function handleCeoQuery(request, env, origin) {
  const cors = { ...corsHeaders(origin), ...SECURITY_HEADERS };

  if (request.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405, origin);
  }

  // ── Verificar JWT ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return jsonResp({ error: 'No autorizado' }, 401, origin);

  // Verificar rol CEO (admin/super_admin) via Supabase
  let userProfile = null;
  try {
    const profileResp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?select=id,role,full_name,company_id&limit=1`,
      { headers: { 'apikey': env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` } }
    );
    const profiles = await profileResp.json();
    userProfile = profiles?.[0];
  } catch (e) { console.error('Profile fetch error:', e); }

  if (!userProfile || !['admin', 'super_admin'].includes(userProfile.role)) {
    return jsonResp({ error: 'Acceso restringido a CEO / Admin' }, 403, origin);
  }

  // ── Parsear body ──────────────────────────────────────────────────────────
  let body;
  try { body = await request.json(); }
  catch { return jsonResp({ error: 'JSON inválido' }, 400, origin); }

  const { question, pulse, query_type = 'ad_hoc' } = body;
  if (!question || question.trim().length < 3) {
    return jsonResp({ error: 'La pregunta está vacía' }, 400, origin);
  }

  // ── Contexto organizacional desde el pulse snapshot ────────────────────
  const p = pulse || {};
  const fmt = (n) => {
    const v = parseFloat(n) || 0;
    return v >= 1e6 ? '$' + (v/1e6).toFixed(1) + 'M'
         : v >= 1e3 ? '$' + (v/1e3).toFixed(0) + 'K'
         : '$' + v.toFixed(0);
  };

  const orgContext = `
═══════════════════════════════════════════════════════
ESTADO ACTUAL DE LA ORGANIZACIÓN — IBANOR SA de CV / MetaTronix
Fecha snapshot: ${p.captured_at ? new Date(p.captured_at).toLocaleString('es-MX') : new Date().toLocaleString('es-MX')}
Score de Salud Org: ${p.org_health_score ?? 'Sin dato'}/100
═══════════════════════════════════════════════════════

VENTAS & COMERCIAL:
• Pipeline total activo: ${fmt(p.pipeline_total)}
• Deals activos: ${p.deals_activos ?? 'Sin dato'}
• Deals ganados este mes: ${p.deals_ganados_mes ?? 'Sin dato'}
• Deals en riesgo: ${p.deals_en_riesgo ?? 'Sin dato'}
• Leads nuevos (7 días): ${p.leads_nuevos_7d ?? 'Sin dato'}
• Tasa de conversión (30d): ${p.conversion_rate ?? 'Sin dato'}%

FINANZAS & TESORERÍA:
• CXC total pendiente: ${fmt(p.cxc_total)}
• CXC vencida: ${fmt(p.cxc_vencida)} (${p.cxc_total > 0 ? ((p.cxc_vencida/p.cxc_total)*100).toFixed(1) : 0}% del total)
• CXP total: ${fmt(p.cxp_total)}
• CXP próximos 30 días: ${fmt(p.cxp_proximos_30d)}
• Flujo neto (CXC-CXP): ${fmt(p.flujo_neto)}
• Facturas urgentes (>60d): ${p.cobranza_urgente ?? 'Sin dato'}

COMPRAS & OPERACIONES:
• Órdenes de compra pendientes: ${p.oc_pendientes ?? 'Sin dato'} (${fmt(p.oc_monto_pendiente)})
• Requisiciones abiertas: ${p.requisiciones_abiertas ?? 'Sin dato'}

PLATAFORMA & ADOPCIÓN IA:
• Usuarios activos: ${p.usuarios_activos ?? 'Sin dato'}
• Consultas IA últimas 24h: ${p.ai_queries_24h ?? 'Sin dato'}
• Consultas IA últimos 7d: ${p.ai_queries_7d ?? 'Sin dato'}
═══════════════════════════════════════════════════════`;

  // ── Detectar dominio(s) de la pregunta ────────────────────────────────
  const q = question.toLowerCase();
  const domains = [];
  if (/venta|pipeline|deal|lead|cliente|conversion|cerrar|quota/.test(q)) domains.push('ventas');
  if (/marketing|campa[ñn]|growth|lead.*gen|posicion/.test(q)) domains.push('marketing');
  if (/cxc|cobr|factura|vencid|pago|flujo|tesorero|cash|cxp|finanzas|fiscal|sat/.test(q)) domains.push('finanzas');
  if (/compra|oc|orden.*compra|proveedor|requisici/.test(q)) domains.push('compras');
  if (/operaci|proceso|eficiencia|kpi|equipo|recurso|productiv/.test(q)) domains.push('operaciones');
  if (/riesgo|alerta|problema|crisis|urgente|critico|peligro/.test(q)) domains.push('riesgo');
  if (domains.length === 0) domains.push('general');

  // ── System prompt del CEO Query Router ──────────────────────────────
  const systemPrompt = `Eres el Consejero Ejecutivo IA de IBANOR SA de CV / MetaTronix.
Tu única función es responder preguntas organizacionales al CEO con DATOS REALES del sistema.
Dominio de la pregunta detectado: ${domains.join(', ')}.

PROTOCOLO ANTI-ALUCINACIÓN NIVEL EJECUTIVO — REGLAS NO NEGOCIABLES:
1. SOLO usa los datos del contexto organizacional provisto. NUNCA inventes cifras adicionales.
2. Cuando cites un número, indica su origen: "(Fuente: Ventas/Pipeline)", "(Fuente: CXC vencida)", etc.
3. HECHO vs ANÁLISIS: distingue claramente qué es dato real ("el sistema registra X") vs interpretación ("esto sugiere Y").
4. Si el dato que necesitas no está en el contexto, escribe explícitamente: "Sin dato disponible en el sistema — requiere verificación manual".
5. CAUSALIDAD: no atribuyas causas sin evidencia directa. Escribe "correlación posible".
6. RECOMENDACIONES: termina con "⚠ Validar con datos actualizados antes de tomar acción".
7. DATOS FINANCIEROS: añade "† Basado en snapshot de ${new Date().toLocaleDateString('es-MX')} — auditar antes de decisiones ejecutivas".

FORMATO: Responde en HTML semántico limpio (h2, h3, p, ul, strong, table). Sin DOCTYPE, html, head, body. Directo al contenido. Máximo 500 palabras. Ejecutivo, concreto, sin rodeos.`;

  const userPrompt = `${orgContext}

PREGUNTA DEL CEO:
"${question}"

Responde con base EXCLUSIVA en los datos del contexto anterior.
Estructura tu respuesta con:
<h2>[ícono relevante] [Respuesta directa en 5 palabras]</h2>
<h3>Datos relevantes</h3>
[cifras del sistema, citando fuente]
<h3>Análisis ejecutivo</h3>
[interpretación basada en los datos]
<h3>Acción recomendada</h3>
[1-3 acciones concretas con ⚠ al final]`;

  // ── Llamar a Claude con streaming ──────────────────────────────────
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResp({ error: 'ANTHROPIC_API_KEY no configurada en el Worker' }, 500, origin);
  }

  let claudeResp;
  try {
    claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } catch (e) {
    return jsonResp({ error: 'Error conectando con Claude: ' + e.message }, 502, origin);
  }

  if (!claudeResp.ok) {
    const errTxt = await claudeResp.text();
    return jsonResp({ error: 'Claude API error ' + claudeResp.status + ': ' + errTxt }, 502, origin);
  }

  // ── Streaming SSE al browser ─────────────────────────────────────
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = claudeResp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const chunk = JSON.stringify({
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: parsed.delta.text }
              });
              await writer.write(encoder.encode(`data: ${chunk}\n\n`));
            }
          } catch (_) {}
        }
      }
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'meta', domains, query_type })}\n\n`));
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (e) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      ...SECURITY_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
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

    if (path === '/hf')         return handleHF(request, env, origin);
    if (path === '/groq')       return handleGroq(request, env, origin);
    if (path === '/ceo-query')  return handleCeoQuery(request, env, origin);

    return handleClaude(request, env, origin);
  },
};
