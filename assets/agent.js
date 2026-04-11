/* ============================================================
   METATRONIX PORTAL — AI Agent (Aria)
   Powered by Claude · Aprende de cada interacción
   ============================================================ */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  const AGENT_NAME   = 'Aria';
  const AGENT_ROLE   = 'Asistente MetaTronix';
  const SESSION_KEY  = 'mtx_agent_session_' + Date.now().toString(36);
  const HISTORY_LIMIT = 20; // mensajes máx en contexto

  let db, currentUser, sessionId, messages = [], isOpen = false, isTyping = false;
  let knowledgeBase = [];
  let approvedDocs  = [];

  /* ── Init ───────────────────────────────────────────────── */
  async function init () {
    db          = typeof getDB === 'function' ? getDB() : null;
    sessionId   = SESSION_KEY;
    currentUser = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;

    if (!currentUser) return; // No mostrar en páginas sin sesión activa (login)

    await loadKnowledge();
    buildUI();
    bindEvents();

    // Cargar historial reciente de esta sesión
    await loadRecentHistory();
  }

  /* ── Cargar base de conocimiento ────────────────────────── */
  async function loadKnowledge () {
    if (!db) return;
    try {
      const { data: kb } = await db
        .from('agent_knowledge')
        .select('title, content, category')
        .eq('is_active', true)
        .order('category');
      if (kb) knowledgeBase = kb;

      // Documentos aprobados (los últimos 20 que tienen contenido)
      const { data: docs } = await db
        .from('documents')
        .select('id, title, doc_type, content, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20);
      if (docs) approvedDocs = docs;
    } catch (_) {}
  }

  /* ── System prompt dinámico ─────────────────────────────── */
  function buildSystemPrompt () {
    const page    = detectPage();
    const userName = currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador';
    const userRole = currentUser?.profile?.role || 'user';

    let kbText = '';
    if (knowledgeBase.length) {
      kbText = '\n\n=== BASE DE CONOCIMIENTO METATRONIX ===\n';
      knowledgeBase.forEach(k => {
        kbText += `\n[${k.category.toUpperCase()}] ${k.title}:\n${k.content}\n`;
      });
    }

    let docsText = '';
    if (approvedDocs.length) {
      docsText = '\n\n=== DOCUMENTOS APROBADOS DISPONIBLES ===\n';
      approvedDocs.forEach(d => {
        const snippet = d.content ? d.content.substring(0, 300) + (d.content.length > 300 ? '…' : '') : 'Sin contenido previo.';
        docsText += `\n- "${d.title}" (${d.doc_type}) — ${snippet}\n`;
      });
    }

    return `Eres Aria, la asistente de inteligencia artificial interna de MetaTronix. Tu rol es ayudar a los colaboradores de IBANOR SA de CV dentro del Portal Interno de Documentos de Ventas.

PERSONALIDAD: Profesional, concisa, proactiva. Respondes en español. Cuando no sabes algo, lo dices con honestidad. Eres parte del ecosistema de inteligencia de MetaTronix.

CONTEXTO ACTUAL:
- Usuario: ${userName} (rol: ${userRole})
- Página actual: ${page.name}
- Descripción de la página: ${page.desc}

SOBRE METATRONIX:
MetaTronix es una empresa global de inteligencia que integra ciencia de datos, inteligencia artificial, automatización y operaciones digitales. Tagline: "Illuminating the Unknown". Más de una década implementando IA en América Latina para gobiernos y grandes organizaciones privadas. Entidad legal en México: IBANOR SA de CV.

SUBSIDIARIAS: Metaview Systems, QuantumTron Analytics, Aria Digital Strategy, Aria New Gen, NeuroTron Lab, CyberTron Defense.

SOBRE EL PORTAL:
- Módulos: Dashboard (métricas), Generar (crear documentos con IA), Leads (gestión de prospectos), Admin (solo admins: usuarios, alertas, configuración)
- Generación: usar Claude AI para crear propuestas comerciales, contratos, cotizaciones, reportes, etc.
- Documentos pasan por flujo: borrador → revisión → aprobado
- Contacto admin: acanales@ibanormexico.com
${kbText}${docsText}

INSTRUCCIONES:
1. Ayuda con navegación, funciones del portal, dudas sobre documentos y MetaTronix.
2. Si el usuario menciona un documento aprobado, puedes resumir o explicar su contenido.
3. Sugiere acciones concretas (ej: "Ve a Generar → selecciona Propuesta Comercial").
4. Respuestas cortas y directas. Usa listas cuando ayuda a la claridad.
5. Si el usuario tiene rol 'user', no menciones funciones de admin.
6. Nunca compartas datos de otros usuarios.`;
  }

  /* ── Detectar página actual ─────────────────────────────── */
  function detectPage () {
    const path = window.location.pathname;
    const pages = {
      '/dashboard.html': { name: 'Dashboard',  desc: 'Vista general con métricas, actividad reciente y documentos del usuario.' },
      '/generate.html':  { name: 'Generación', desc: 'Módulo para crear documentos con IA: propuestas, contratos, cotizaciones.' },
      '/leads.html':     { name: 'Leads',      desc: 'Gestión de prospectos y clientes de ventas.' },
      '/admin.html':     { name: 'Admin',      desc: 'Panel de administración: usuarios, alertas, configuración del portal.' },
      '/':               { name: 'Login',      desc: 'Página de acceso al portal.' },
      '/index.html':     { name: 'Login',      desc: 'Página de acceso al portal.' },
    };
    return pages[path] || { name: path, desc: 'Página del portal.' };
  }

  /* ── Cargar historial reciente ──────────────────────────── */
  async function loadRecentHistory () {
    if (!db || !currentUser) return;
    try {
      const { data } = await db
        .from('agent_conversations')
        .select('messages, page_context')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (data && data.messages && data.messages.length) {
        // Restaurar últimos 6 mensajes de la sesión anterior como contexto
        const prev = data.messages.slice(-6);
        prev.forEach(m => {
          if (m.role !== 'system') messages.push(m);
        });
      }
    } catch (_) {}
  }

  /* ── Guardar conversación ───────────────────────────────── */
  async function saveConversation () {
    if (!db || !currentUser) return;
    const topic = detectTopic();
    try {
      await db.from('agent_conversations').upsert({
        user_id:      currentUser.id,
        session_id:   sessionId,
        messages:     messages,
        page_context: detectPage().name,
        topic:        topic,
        updated_at:   new Date().toISOString()
      }, { onConflict: 'session_id' });
    } catch (_) {}
  }

  function detectTopic () {
    const last = messages.filter(m => m.role === 'user').slice(-1)[0];
    if (!last) return 'general';
    const txt = last.content.toLowerCase();
    if (txt.includes('generar') || txt.includes('documento') || txt.includes('propuesta')) return 'generacion';
    if (txt.includes('lead') || txt.includes('prospecto') || txt.includes('cliente')) return 'leads';
    if (txt.includes('admin') || txt.includes('usuario')) return 'admin';
    if (txt.includes('metatronix') || txt.includes('empresa')) return 'empresa';
    return 'general';
  }

  /* ── Call Claude via proxy ──────────────────────────────── */
  async function callClaude (userMessage) {
    const proxyUrl = window.MTX_CONFIG?.CLAUDE_PROXY_URL;
    if (!proxyUrl) return 'Error: proxy no configurado.';

    messages.push({ role: 'user', content: userMessage });

    // Mantener historial limitado (excluye system)
    const contextMsgs = messages.slice(-HISTORY_LIMIT);

    try {
      const res = await fetch(proxyUrl + '/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system:     buildSystemPrompt(),
          messages:   contextMsgs,
          stream:     false
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Error ' + res.status);
      }

      const data = await res.json();
      const reply = data.content?.[0]?.text || 'Sin respuesta.';
      messages.push({ role: 'assistant', content: reply });
      await saveConversation();
      return reply;
    } catch (e) {
      messages.push({ role: 'assistant', content: 'Lo siento, ocurrió un error al procesar tu consulta. Intenta de nuevo.' });
      return 'Lo siento, ocurrió un error. Intenta de nuevo en un momento.';
    }
  }

  /* ── Render markdown básico ─────────────────────────────── */
  function renderMarkdown (text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#e8edf3;padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
      .replace(/^### (.+)$/gm, '<strong>$1</strong>')
      .replace(/^## (.+)$/gm, '<strong>$1</strong>')
      .replace(/^# (.+)$/gm, '<strong>$1</strong>')
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  /* ── Build UI ───────────────────────────────────────────── */
  function buildUI () {
    // Trigger button
    const btn = document.createElement('button');
    btn.id = 'mtx-agent-btn';
    btn.setAttribute('aria-label', 'Abrir asistente Aria');
    btn.innerHTML = `
      <svg class="icon-chat" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      <span id="mtx-agent-badge"></span>`;

    // Panel
    const panel = document.createElement('div');
    panel.id = 'mtx-agent-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Asistente Aria de MetaTronix');

    const initials = (currentUser?.profile?.full_name || currentUser?.email || 'U')
      .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    panel.innerHTML = `
      <!-- Header -->
      <div class="agent-header">
        <div class="agent-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <circle cx="12" cy="8" r="4"/>
            <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
            <path d="M2 12h2M20 12h2M12 2v2M12 20v2"/>
          </svg>
        </div>
        <div class="agent-header-info">
          <div class="agent-name">${AGENT_NAME} · ${AGENT_ROLE}</div>
          <div class="agent-status">
            <span class="agent-status-dot"></span>
            En línea · MetaTronix Intelligence
          </div>
        </div>
        <div class="agent-header-actions">
          <button class="agent-header-btn" id="agent-clear-btn" title="Nueva conversación">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.51"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="agent-messages" id="agent-messages">
        <div class="agent-welcome">
          <div class="agent-welcome-title">⬡ Hola, soy ${AGENT_NAME}</div>
          <div class="agent-welcome-text">
            Tu asistente de inteligencia interna de MetaTronix. Puedo ayudarte con el portal,
            documentos, información de la empresa y cualquier duda sobre tus herramientas.
          </div>
        </div>
        <div class="agent-quick-actions" id="agent-quick-actions">
          <button class="quick-action-btn" data-icon="📄" data-msg="¿Cómo genero un documento con IA?">
            ¿Cómo genero un documento con IA?
          </button>
          <button class="quick-action-btn" data-icon="🏢" data-msg="¿Qué hace MetaTronix y cuáles son sus subsidiarias?">
            ¿Qué hace MetaTronix?
          </button>
          <button class="quick-action-btn" data-icon="📋" data-msg="¿Qué documentos aprobados tenemos disponibles?">
            Ver documentos aprobados
          </button>
          <button class="quick-action-btn" data-icon="🔍" data-msg="¿Cómo funciona el flujo de aprobación de documentos?">
            Flujo de aprobación
          </button>
        </div>
      </div>

      <!-- Input -->
      <div class="agent-input-area">
        <textarea
          id="mtx-agent-input"
          placeholder="Escribe tu pregunta…"
          rows="1"
          autocomplete="off"
          maxlength="2000"
        ></textarea>
        <button id="mtx-agent-send" title="Enviar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div class="agent-footer-note">ARIA · METATRONIX INTELLIGENCE · POWERED BY CLAUDE</div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  /* ── Bind events ────────────────────────────────────────── */
  function bindEvents () {
    const btn    = document.getElementById('mtx-agent-btn');
    const panel  = document.getElementById('mtx-agent-panel');
    const input  = document.getElementById('mtx-agent-input');
    const send   = document.getElementById('mtx-agent-send');
    const clear  = document.getElementById('agent-clear-btn');
    const msgBox = document.getElementById('agent-messages');

    // Toggle panel
    btn.addEventListener('click', () => togglePanel());

    // Send message
    send.addEventListener('click', () => sendMessage());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    // Quick action buttons
    msgBox.addEventListener('click', (e) => {
      const qa = e.target.closest('.quick-action-btn');
      if (qa) {
        const msg = qa.getAttribute('data-msg');
        document.getElementById('agent-quick-actions')?.remove();
        sendMessage(msg);
      }
    });

    // Clear conversation
    clear.addEventListener('click', () => {
      messages = [];
      sessionId = 'mtx_agent_session_' + Date.now().toString(36);
      const msgBox = document.getElementById('agent-messages');
      msgBox.innerHTML = `
        <div class="agent-welcome">
          <div class="agent-welcome-title">⬡ Nueva conversación</div>
          <div class="agent-welcome-text">¿En qué te puedo ayudar?</div>
        </div>`;
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (isOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
        togglePanel(false);
      }
    });
  }

  /* ── Toggle panel ───────────────────────────────────────── */
  function togglePanel (force) {
    const btn   = document.getElementById('mtx-agent-btn');
    const panel = document.getElementById('mtx-agent-panel');
    isOpen = force !== undefined ? force : !isOpen;
    btn.classList.toggle('open', isOpen);
    panel.classList.toggle('open', isOpen);
    if (isOpen) {
      document.getElementById('mtx-agent-input')?.focus();
      scrollMessages();
    }
  }

  /* ── Send message ───────────────────────────────────────── */
  async function sendMessage (overrideText) {
    const input = document.getElementById('mtx-agent-input');
    const text  = overrideText || input?.value?.trim();
    if (!text || isTyping) return;

    if (input && !overrideText) {
      input.value = '';
      input.style.height = 'auto';
    }

    appendMessage('user', text);
    showTyping();

    document.getElementById('mtx-agent-send').disabled = true;
    isTyping = true;

    const reply = await callClaude(text);

    hideTyping();
    appendMessage('agent', reply);

    document.getElementById('mtx-agent-send').disabled = false;
    isTyping = false;
  }

  /* ── Append message ─────────────────────────────────────── */
  function appendMessage (role, text) {
    const msgBox = document.getElementById('agent-messages');
    if (!msgBox) return;

    const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const initials = (currentUser?.profile?.full_name || currentUser?.email || 'U')
      .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const div = document.createElement('div');
    div.className = `msg ${role}`;

    const avatarHTML = role === 'agent'
      ? `<div class="msg-avatar">⬡</div>`
      : `<div class="msg-avatar">${initials}</div>`;

    const rendered = renderMarkdown(text);
    div.innerHTML = `
      ${avatarHTML}
      <div>
        <div class="msg-bubble"><p>${rendered}</p></div>
      </div>
      <div class="msg-time">${now}</div>`;

    msgBox.appendChild(div);
    scrollMessages();
  }

  /* ── Typing indicator ───────────────────────────────────── */
  function showTyping () {
    const msgBox = document.getElementById('agent-messages');
    if (!msgBox) return;
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = 'agent-typing';
    div.innerHTML = `
      <div class="msg-avatar">⬡</div>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>`;
    msgBox.appendChild(div);
    scrollMessages();
  }

  function hideTyping () {
    document.getElementById('agent-typing')?.remove();
  }

  /* ── Scroll messages ────────────────────────────────────── */
  function scrollMessages () {
    const msgBox = document.getElementById('agent-messages');
    if (msgBox) setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 50);
  }

  /* ── Boot ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure app.js auth is ready
    setTimeout(init, 800);
  }

})();
