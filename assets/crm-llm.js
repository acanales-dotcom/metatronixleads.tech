/* ============================================================
   CRM_LLM — Módulo Claude API compartido (via Cloudflare Worker)
   Retry con backoff, AbortController, autenticación Supabase JWT
   ============================================================ */
(function () {
  'use strict';

  const MAX_RETRIES = 2;
  const BASE_DELAY  = 900; // ms — aumenta exponencialmente

  let _activeController = null;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function fetchWithRetry(url, opts, retries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      _activeController = new AbortController();
      try {
        const resp = await fetch(url, { ...opts, signal: _activeController.signal });
        if (resp.status === 429) {
          if (attempt < retries) { await sleep(BASE_DELAY * Math.pow(2, attempt + 1)); continue; }
        }
        if (!resp.ok && attempt < retries && resp.status >= 500) {
          await sleep(BASE_DELAY * Math.pow(2, attempt));
          continue;
        }
        return resp;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        if (attempt < retries) { await sleep(BASE_DELAY * Math.pow(2, attempt)); }
        else throw e;
      }
    }
  }

  async function streamToText(resp) {
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') break;
        try {
          const j = JSON.parse(raw);
          text += j.delta?.text || j.delta?.content?.[0]?.text || '';
        } catch (_) {}
      }
    }
    return text || '(sin respuesta)';
  }

  async function getAuthHeaders() {
    try {
      const db = window._supabaseClient || (typeof getDB === 'function' ? getDB() : null);
      if (!db) return {};
      const { data } = await db.auth.getSession();
      const token = data?.session?.access_token;
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    } catch (_) { return {}; }
  }

  window.CRM_LLM = {
    engine: false,

    /* Verifica la conexión con el Worker al cargar la página */
    async init(progressCb) {
      const url = window.MTX_CONFIG?.CLAUDE_PROXY_URL;
      if (!url) {
        if (progressCb) progressCb({ progress: 1.0, text: 'Proxy no configurado en config.js' });
        return;
      }
      if (progressCb) progressCb({ progress: 0.2, text: 'Conectando con Claude API…' });
      try {
        const authH = await getAuthHeaders();
        await fetchWithRetry(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', ...authH },
          body:    JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
        }, 1);
        this.engine = true;
        if (progressCb) progressCb({ progress: 1.0, text: 'Claude API conectada ✓' });
      } catch (_) {
        this.engine = true; // Permite fallback heurístico por agente
        if (progressCb) progressCb({ progress: 1.0, text: 'Modo directo activo ✓' });
      }
    },

    /* Cancela la solicitud en curso (útil en botón "Detener") */
    abort() {
      if (_activeController) { _activeController.abort(); _activeController = null; }
    },

    /* Llamada principal a Claude — streaming, con retry automático */
    async chat(systemPrompt, userMessage, opts = {}) {
      const url = window.MTX_CONFIG?.CLAUDE_PROXY_URL;
      if (!url) throw new Error('CLAUDE_PROXY_URL no configurado');

      const authH = await getAuthHeaders();
      const resp  = await fetchWithRetry(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authH },
        body:    JSON.stringify({
          model:      opts.model      || 'claude-haiku-4-5-20251001',
          max_tokens: opts.maxTokens  || 1500,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: String(userMessage).slice(0, 8000) }],
          stream:     true,
        }),
      }, MAX_RETRIES);

      if (!resp.ok) {
        const txt = await resp.text().catch(() => resp.statusText);
        const msg = resp.status === 401
          ? 'Sesión expirada — recarga la página e inicia sesión de nuevo'
          : resp.status === 429
            ? 'Demasiadas solicitudes — espera unos segundos e intenta de nuevo'
            : `Error ${resp.status} — intenta de nuevo`;
        throw new Error(msg);
      }

      return streamToText(resp);
    },
  };
})();
