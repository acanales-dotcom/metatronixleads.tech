/* ============================================================
   METATRONIXLEADS.TECH — Configuración Central
   Todos los assets usan MTX_CONFIG.ASSET_V como cache buster
   ============================================================ */
window.MTX_CONFIG = {
  /* ── Supabase ─────────────────────────────────────────────── */
  SUPABASE_URL:      'https://hodrfonbpmqulkyzrzpq.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZHJmb25icG1xdWxreXpyenBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTQ5NTUsImV4cCI6MjA5MTQ5MDk1NX0._M-_8jazg7q6Lt9F0Ia4MNWeCO4Q83zAqKsnpCIenFY',

  /* ── Cloudflare Worker ────────────────────────────────────── */
  CLAUDE_PROXY_URL:  'https://claude-proxy.acanales-7d4.workers.dev',

  /* ── App ──────────────────────────────────────────────────── */
  APP_NAME:    'MetaTronix Portal',
  COMPANY:     'IBANOR SA de CV',
  VERSION:     '3.0.0',

  /* ── Asset cache buster — bumpar al hacer deploy ──────────── */
  /* Formato: AAAAMMDDNN (NN = número de deploy del día)         */
  ASSET_V:     '202604181',
};

/* ── Registro del Service Worker ─────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/assets/sw.js')
      .catch(() => {}); // Silencioso si falla (HTTP, permisos, etc.)
  });
}
