/* ============================================================
   MetaTronix Portal — Service Worker
   Stale-while-revalidate para assets estáticos
   ============================================================ */
const CACHE = 'mtx-v20260420c';
const STATIC = [
  '/assets/style.css',
  '/assets/app.js',
  '/assets/crm-llm.js',
  '/assets/agent.js',
  '/assets/agent.css',
  '/assets/salescoach.js',
  '/assets/teamchat.js',
  '/config.js',
];

/* Instalación: pre-cachear assets críticos */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .catch(() => {}) // No fallar si algún asset 404
  );
  self.skipWaiting();
});

/* Activación: limpiar caches viejas */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch: network-first para JS, stale-while-revalidate para el resto */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/supabase') || url.hostname.includes('workers.dev')) return;

  // JS siempre fresco desde la red (nunca stale)
  if (url.pathname.endsWith('.js')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.ok) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // CSS/HTML/imágenes: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(resp => {
          if (resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fetched;
      })
    )
  );
});
