// ============================================================
// MTX-SECURITY-HEADERS — Cloudflare Worker v1.0
// Intercepta todo el tráfico de metatronixleads.tech
// y añade HTTP Security Headers de nivel producción.
// ============================================================
// Deploy:
//   PUT /api/v4/accounts/{ACCOUNT_ID}/workers/scripts/mtx-security-headers
//   Worker Route: metatronixleads.tech/* → mtx-security-headers
// ============================================================

const ALLOWED_ORIGIN = 'https://metatronixleads.tech';

// ── Security Headers ────────────────────────────────────────
const SECURITY_HEADERS = {
  // HSTS: fuerza HTTPS por 1 año, incluye subdominios
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Previene MIME sniffing (e.g., JS malicioso en imagen)
  'X-Content-Type-Options': 'nosniff',

  // Bloquea clickjacking — nadie puede poner el portal en iframe
  'X-Frame-Options': 'DENY',

  // Limita información de referrer enviada a terceros
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Deshabilita features del browser no necesarias
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'interest-cohort=()',    // bloquea FLoC
  ].join(', '),

  // CSP: whitelist estricta para el portal
  'Content-Security-Policy': [
    "default-src 'self'",
    // Scripts: self + CDN de confianza + inline necesario para el portal
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
    // Estilos: self + Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Fuentes
    "font-src 'self' https://fonts.gstatic.com data:",
    // Imágenes: self + data URIs + HTTPS general
    "img-src 'self' data: blob: https:",
    // Conexiones: solo Supabase y el Worker proxy
    "connect-src 'self' https://hodrfonbpmqulkyzrzpq.supabase.co https://claude-proxy.acanales-7d4.workers.dev https://mtx-error-tracker.acanales-7d4.workers.dev",
    // No iframes
    "frame-ancestors 'none'",
    // No plugins (Flash, etc.)
    "object-src 'none'",
    // base href solo self
    "base-uri 'self'",
    // Formularios solo a self
    "form-action 'self'",
    // Upgrade automático a HTTPS
    "upgrade-insecure-requests",
  ].join('; '),

  // Compatibilidad con browsers viejos (XSS filter)
  'X-XSS-Protection': '1; mode=block',

  // Elimina header que revela tecnología del servidor
  'X-Powered-By': '',
};

// Headers a eliminar de la respuesta origen (revelan info interna)
const HEADERS_TO_REMOVE = [
  'x-powered-by',
  'server',
  'x-aspnet-version',
  'x-aspnetmvc-version',
];

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ── Manejo de preflight CORS (OPTIONS) ────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          ...SECURITY_HEADERS,
        },
      });
    }

    // ── Fetch origen (GitHub Pages via Cloudflare cache) ──
    let response;
    try {
      response = await fetch(request);
    } catch (err) {
      return new Response('Gateway Error', { status: 502 });
    }

    // ── Construir respuesta con headers de seguridad ──────
    const newHeaders = new Headers(response.headers);

    // Eliminar headers que revelan info del servidor
    for (const h of HEADERS_TO_REMOVE) {
      newHeaders.delete(h);
    }

    // Añadir todos los security headers
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      if (value) newHeaders.set(key, value);
      else newHeaders.delete(key);
    }

    // HSTS extra explícito (crítico para preload)
    newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    newHeaders,
    });
  },
};
