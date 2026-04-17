// ============================================================
// METATRONIXLEADS.TECH — Cloudflare Worker: Claude API Proxy
// ============================================================
// Deploy en: https://workers.cloudflare.com
// Agrega el secreto: ANTHROPIC_API_KEY → tu key de Anthropic
// Después actualiza CLAUDE_PROXY_URL en config.js con la URL
// de este worker.
// ============================================================

const ALLOWED_ORIGINS = [
  'https://metatronixleads.tech',
  'https://www.metatronixleads.tech',
  'https://acanales-dotcom.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
];

const SUPABASE_URL = 'https://hodrfonbpmqulkyzrzpq.supabase.co';

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, X-Client-Info, Prefer, Range',
    'Access-Control-Expose-Headers': 'Content-Range, X-Content-Range',
    'Access-Control-Max-Age':       '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── Ruta /supabase/* → proxy transparente a Supabase ─────────────────────
    if (url.pathname.startsWith('/supabase')) {
      const supaPath = url.pathname.replace(/^\/supabase/, '') || '/';
      const supaTarget = SUPABASE_URL + supaPath + url.search;

      // Reenviar headers relevantes, excepto host
      const fwdHeaders = new Headers();
      for (const [k, v] of request.headers.entries()) {
        const kl = k.toLowerCase();
        if (kl === 'host' || kl === 'origin' || kl === 'referer') continue;
        fwdHeaders.set(k, v);
      }

      try {
        const supaRes = await fetch(supaTarget, {
          method:  request.method,
          headers: fwdHeaders,
          body:    ['GET','HEAD'].includes(request.method) ? undefined : request.body,
        });

        const resHeaders = new Headers(corsHeaders(origin));
        // Copiar headers relevantes de la respuesta de Supabase
        for (const h of ['content-type','content-range','x-content-range','etag','cache-control']) {
          const v = supaRes.headers.get(h);
          if (v) resHeaders.set(h, v);
        }

        return new Response(supaRes.body, {
          status:  supaRes.status,
          headers: resHeaders,
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: 'Supabase proxy error: ' + err.message }),
          { status: 502, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
        );
      }
    }

    // Solo POST para las demás rutas (Claude, Perplexity)
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // ── Ruta /perplexity → proxy a Perplexity AI ──────────────────
    if (url.pathname === '/perplexity') {
      if (!env.PERPLEXITY_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'PERPLEXITY_API_KEY no configurada en el Worker' }),
          { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
        );
      }
      try {
        const body = await request.json();
        const pRes = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.PERPLEXITY_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!pRes.ok) {
          const err = await pRes.text();
          return new Response(
            JSON.stringify({ error: `Perplexity error ${pRes.status}: ${err}` }),
            { status: pRes.status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
          );
        }
        // Streaming or JSON — pass through as-is
        const contentType = pRes.headers.get('content-type') || 'application/json';
        return new Response(pRes.body, {
          status: 200,
          headers: { ...corsHeaders(origin), 'Content-Type': contentType, 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Ruta raíz / → proxy a Claude (Anthropic) ─────────────────
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en el Worker' }),
        { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    try {
      const body = await request.json();

      // Llamar a Claude API (streaming)
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
        return new Response(
          JSON.stringify({ error: `Claude API error ${claudeRes.status}: ${err}` }),
          { status: claudeRes.status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
        );
      }

      return new Response(claudeRes.body, {
        status: 200,
        headers: {
          ...corsHeaders(origin),
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }
  },
};
