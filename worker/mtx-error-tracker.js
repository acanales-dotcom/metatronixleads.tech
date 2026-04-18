// ============================================================
// MTX-ERROR-TRACKER — Cloudflare Worker v1.0
// Recibe errores del frontend y los persiste en Supabase
// activity_logs para visibilidad de producción.
// ============================================================
// Deploy: PUT /api/v4/accounts/{ID}/workers/scripts/mtx-error-tracker
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ============================================================

const ALLOWED_ORIGINS = [
  'https://metatronixleads.tech',
  'https://www.metatronixleads.tech',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS
    const corsH = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsH });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsH });
    }

    // Bloquear orígenes no permitidos
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response('Bad Request', { status: 400, headers: corsH }); }

    const {
      message = 'Unknown error',
      source = '',
      lineno = 0,
      colno = 0,
      stack = '',
      url = '',
      user_agent = '',
      user_id = null,
      level = 'error',    // 'error' | 'warn' | 'info'
      context = {},       // datos adicionales { page, action, etc. }
    } = body;

    // Guardar en Supabase activity_logs
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
      try {
        await fetch(`${env.SUPABASE_URL}/rest/v1/activity_logs`, {
          method: 'POST',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            user_id: user_id || null,
            action: `frontend_${level}`,
            details: JSON.stringify({
              message: message.substring(0, 500),
              source: source.substring(0, 200),
              lineno,
              colno,
              stack: stack.substring(0, 1000),
              url: url.substring(0, 200),
              user_agent: user_agent.substring(0, 200),
              context,
            }),
            created_at: new Date().toISOString(),
          }),
        });
      } catch (e) {
        // No fallar el endpoint si Supabase falla
        console.error('Error saving to Supabase:', e.message);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsH, 'Content-Type': 'application/json' },
    });
  },
};
