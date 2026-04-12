/* ============================================================
   METATRONIX PORTAL — AI Agent (Aria)
   Powered by Claude · Aprende de cada interacción
   ============================================================ */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  const AGENT_NAME   = 'Clippy';
  const AGENT_ROLE   = 'Agente de Seguimiento';
  const SESSION_KEY  = 'mtx_agent_session_' + Date.now().toString(36);
  const HISTORY_LIMIT = 20; // mensajes máx en contexto

  let db, currentUser, sessionId, messages = [], isOpen = false, isTyping = false;
  let knowledgeBase   = [];   // agent_knowledge (legacy)
  let websiteSources  = [];   // knowledge_sources (scraped websites)
  let sharedDocs      = [];   // metatronix_docs con text_content
  let approvedDocs    = [];   // documents aprobados del portal

  /* ── Clippy SVG ─────────────────────────────────────────────── */
  function clippySVG (id) {
    return `<svg id="${id}" class="clippy-svg" viewBox="0 0 64 82" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cg1-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d4dae8"/>
      <stop offset="100%" stop-color="#8890a4"/>
    </linearGradient>
    <linearGradient id="cg2-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c0c8d8"/>
      <stop offset="100%" stop-color="#9098b0"/>
    </linearGradient>
    <filter id="cshadow-${id}">
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="rgba(0,0,0,.25)"/>
    </filter>
  </defs>
  <!-- Paperclip body -->
  <g class="clippy-body" filter="url(#cshadow-${id})">
    <!-- Outer loop left side down -->
    <path d="M32 5 C16 5 9 16 9 28 L9 64 C9 73 15 79 24 79 C30 79 35 76 37 70"
          fill="none" stroke="url(#cg1-${id})" stroke-width="5.5" stroke-linecap="round"/>
    <!-- Outer loop top -->
    <path d="M32 5 C48 5 55 16 55 28 L55 50 C55 58 49 63 41 63 L9 63"
          fill="none" stroke="url(#cg2-${id})" stroke-width="5" stroke-linecap="round"/>
    <!-- Inner loop -->
    <path d="M32 16 C22 16 17 22 17 30 L17 52"
          fill="none" stroke="url(#cg1-${id})" stroke-width="4" stroke-linecap="round"/>
    <path d="M32 16 C42 16 47 22 47 30 L47 50"
          fill="none" stroke="url(#cg2-${id})" stroke-width="4" stroke-linecap="round"/>
  </g>
  <!-- Eyes -->
  <g class="clippy-eyes">
    <!-- Left eye white -->
    <ellipse cx="22" cy="33" rx="8" ry="9" fill="white" stroke="#70788a" stroke-width="1.3"/>
    <!-- Right eye white -->
    <ellipse cx="42" cy="33" rx="8" ry="9" fill="white" stroke="#70788a" stroke-width="1.3"/>
    <!-- Left pupil -->
    <circle class="clippy-pupil-l" cx="23" cy="34" r="4.8" fill="#141420"/>
    <!-- Right pupil -->
    <circle class="clippy-pupil-r" cx="43" cy="34" r="4.8" fill="#141420"/>
    <!-- Left shine -->
    <circle cx="25" cy="31" r="2" fill="white"/>
    <!-- Right shine -->
    <circle cx="45" cy="31" r="2" fill="white"/>
  </g>
</svg>`;
  }

  /* ── Set Clippy talking state ───────────────────────────────── */
  function setClippyTalking (active) {
    const avatar = document.getElementById('clippy-header-avatar');
    if (!avatar) return;
    if (active) avatar.classList.add('clippy-talking');
    else avatar.classList.remove('clippy-talking');
  }

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
      // 1. Sitios web scrapeados de MetaTronix y subsidiarias
      const { data: sites } = await db
        .from('knowledge_sources')
        .select('title, source_url, content, source_type')
        .order('created_at', { ascending: true });
      if (sites) websiteSources = sites;

      // 2. Documentos externos subidos por colaboradores (solo los que tienen texto extraído)
      const { data: mtxDocs } = await db
        .from('metatronix_docs')
        .select('id, title, description, category, file_name, uploaded_by_name, text_content, created_at')
        .eq('visibility', 'all')
        .order('created_at', { ascending: false })
        .limit(30);
      if (mtxDocs) sharedDocs = mtxDocs;

      // 3. Documentos aprobados del portal (generados con IA)
      const { data: docs } = await db
        .from('documents')
        .select('id, title, doc_type, content, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(15);
      if (docs) approvedDocs = docs;

      // 4. knowledge_base legacy (agent_knowledge table si existe)
      const { data: kb } = await db
        .from('agent_knowledge')
        .select('title, content, category')
        .eq('is_active', true)
        .order('category');
      if (kb) knowledgeBase = kb;
    } catch (_) {}
  }

  /* ── System prompt dinámico ─────────────────────────────── */
  function buildSystemPrompt () {
    const page     = detectPage();
    const userName = currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador';
    const userRole = currentUser?.profile?.role || 'user';
    const isAdmin  = ['admin','super_admin','admin_restringido'].includes(userRole);

    // ── Sección 1: Sitios web de MetaTronix y subsidiarias ──
    let sitesText = '';
    if (websiteSources.length) {
      sitesText = '\n\n════════════════════════════════════════\n';
      sitesText += 'INFORMACIÓN OFICIAL DE METATRONIX Y SUBSIDIARIAS\n';
      sitesText += '════════════════════════════════════════\n';
      websiteSources.forEach(s => {
        sitesText += `\n▸ ${s.title} (${s.source_url})\n${s.content}\n`;
      });
    }

    // ── Sección 2: Documentos externos subidos por colaboradores ──
    const docsWithText = sharedDocs.filter(d => d.text_content && d.text_content.trim().length > 20);
    const docsMetaOnly = sharedDocs.filter(d => !d.text_content || d.text_content.trim().length <= 20);

    let sharedDocsText = '';
    if (sharedDocs.length) {
      sharedDocsText = '\n\n════════════════════════════════════════\n';
      sharedDocsText += 'DOCUMENTOS EXTERNOS SUBIDOS POR COLABORADORES\n';
      sharedDocsText += '════════════════════════════════════════\n';
      if (docsWithText.length) {
        sharedDocsText += '\nDocumentos con contenido extraído:\n';
        docsWithText.forEach(d => {
          sharedDocsText += `\n▸ "${d.title}" [${d.category}] — subido por ${d.uploaded_by_name || 'colaborador'}\n`;
          sharedDocsText += `  Archivo: ${d.file_name}\n`;
          if (d.description) sharedDocsText += `  Descripción: ${d.description}\n`;
          sharedDocsText += `  Contenido:\n${d.text_content.slice(0, 3000)}\n`;
        });
      }
      if (docsMetaOnly.length) {
        sharedDocsText += '\nDocumentos disponibles (binarios — sin texto extraído):\n';
        docsMetaOnly.forEach(d => {
          sharedDocsText += `  • "${d.title}" [${d.category}] — ${d.file_name}`;
          if (d.description) sharedDocsText += ` — ${d.description}`;
          sharedDocsText += '\n';
        });
      }
    }

    // ── Sección 3: Documentos generados con IA (aprobados) ──
    let approvedText = '';
    if (approvedDocs.length) {
      approvedText = '\n\n════════════════════════════════════════\n';
      approvedText += 'DOCUMENTOS GENERADOS EN EL PORTAL (APROBADOS)\n';
      approvedText += '════════════════════════════════════════\n';
      approvedDocs.forEach(d => {
        const snippet = d.content
          ? d.content.replace(/<[^>]*>/g, ' ').trim().slice(0, 400) + '…'
          : 'Sin contenido disponible.';
        approvedText += `\n▸ "${d.title}" (${d.doc_type})\n  ${snippet}\n`;
      });
    }

    // ── Sección 4: KB legacy ──
    let kbText = '';
    if (knowledgeBase.length) {
      kbText = '\n\n════════════════════════════════════════\n';
      kbText += 'BASE DE CONOCIMIENTO ADICIONAL\n';
      kbText += '════════════════════════════════════════\n';
      knowledgeBase.forEach(k => {
        kbText += `\n[${(k.category||'').toUpperCase()}] ${k.title}:\n${k.content}\n`;
      });
    }

    const hasAnyKnowledge = websiteSources.length || sharedDocs.length || approvedDocs.length;

    return `Eres Clippy, el Agente Inteligente de MetaTronix. Asistes a los colaboradores de IBANOR SA de CV en el Portal Interno.

IDENTIDAD: Eres un experto en MetaTronix y todas sus subsidiarias. Respondes siempre en español. Tienes una personalidad servicial, directa y con un leve toque de humor de oficina. Ocasionalmente puedes hacer referencias sutiles y cálidas a tu historia como asistente de oficina clásico.

USUARIO ACTUAL:
- Nombre: ${userName}
- Rol: ${userRole}
- Página: ${page.name} — ${page.desc}

SOBRE EL PORTAL METATRONIX:
- Módulos: Dashboard (métricas y documentos), Generar (crear docs con IA), Leads (prospectos y seguimiento), Docs MTX (biblioteca compartida), Admin (solo admins)
- Flujo de documentos: borrador → revisión → aprobado
- Contacto admin: acanales@ibanormexico.com
${sitesText}${sharedDocsText}${approvedText}${kbText}

════════════════════════════════════════
REGLAS DE COMPORTAMIENTO — MUY IMPORTANTE
════════════════════════════════════════
1. FUENTE EXCLUSIVA: Tu conocimiento sobre MetaTronix, sus productos, servicios y subsidiarias proviene ÚNICAMENTE de la información proporcionada arriba (sitios web oficiales y documentos subidos). NO uses conocimiento externo ni suposiciones sobre la empresa.
2. Si el usuario pregunta algo sobre MetaTronix que NO está en las fuentes anteriores, di honestamente: "No tengo información sobre eso en mis fuentes actuales. Puedes subir un documento con esa información en Docs MTX para que pueda aprenderlo."
3. Si el usuario sube un nuevo documento, Clippy aprenderá de él en la próxima sesión automáticamente.
4. Para preguntas sobre el portal (navegación, funciones, flujos), responde con conocimiento propio del sistema.
5. ${isAdmin ? 'Como admin, puedes ver información completa de todos los usuarios y configuraciones.' : 'No menciones funciones de admin ni datos de otros usuarios.'}
6. Respuestas concisas. Usa listas solo cuando clarifiquen. Sugiere acciones concretas cuando sea útil.
7. Nunca compartas datos personales de otros colaboradores.
${!hasAnyKnowledge ? '\nNOTA: Aún no hay documentos ni fuentes web cargadas. Responde solo sobre el portal y sus funciones.' : ''}`;
  }

  /* ── Detectar página actual ─────────────────────────────── */
  function detectPage () {
    const path = window.location.pathname;
    const pages = {
      '/dashboard.html': { name: 'Dashboard',  desc: 'Vista general con métricas, actividad reciente y documentos del usuario.' },
      '/generate.html':  { name: 'Generación', desc: 'Módulo para crear documentos con IA: propuestas, contratos, cotizaciones.' },
      '/leads.html':     { name: 'Leads',      desc: 'Gestión de prospectos y clientes de ventas.' },
      '/admin.html':     { name: 'Admin',      desc: 'Panel de administración: usuarios, alertas, configuración del portal.' },
      '/mtx-docs.html':  { name: 'Docs MTX',   desc: 'Biblioteca de documentos compartidos de MetaTronix. Todos los usuarios pueden subir y descargar archivos.' },
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
      const isAuthErr = e.message && (e.message.includes('401') || e.message.includes('authentication') || e.message.includes('api-key'));
      const reply = isAuthErr
        ? 'Clippy está pendiente de activación. El administrador debe configurar la API key. Contacta a acanales@ibanormexico.com.'
        : 'Ocurrió un error al conectar con Clippy. Intenta de nuevo en un momento.';
      messages.push({ role: 'assistant', content: reply });
      return reply;
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
    btn.innerHTML = clippySVG('clippy-svg') + `<span id="mtx-agent-badge"></span>`;

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
        <div class="agent-avatar" id="clippy-header-avatar">
          ${clippySVG('clippy-header')}
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
          <div class="agent-welcome-title">📎 ¡Hola! Parece que estás trabajando en MetaTronix.</div>
          <div class="agent-welcome-text">
            Soy Clippy, tu agente de seguimiento. Puedo ayudarte con documentos, prospectos,
            el portal y cualquier duda sobre MetaTronix. ¿Necesitas ayuda?
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
      <div class="agent-footer-note">CLIPPY · METATRONIX · POWERED BY CLAUDE AI</div>
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
          <div class="agent-welcome-title">📎 Nueva conversación</div>
          <div class="agent-welcome-text">¡Listo para ayudarte con el seguimiento!</div>
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

    // ── Verificar acceso a Claude ──────────────────────────
    if (currentUser?.id && typeof checkClaudeAccess === 'function') {
      const access = await checkClaudeAccess(currentUser.id);
      if (!access.allowed) {
        if (input && !overrideText) { input.value = ''; input.style.height = 'auto'; }
        const msgs = {
          disabled:     '🚫 El acceso a Clippy (Claude) está deshabilitado por el administrador.',
          pending_auth: '⏳ Alcanzaste tu límite mensual. Tu solicitud de autorización fue enviada al SuperAdmin.',
          limit_reached:`⚠️ Límite mensual alcanzado (${access.used}/${access.limit} usos). Solicitud enviada al administrador.`,
        };
        appendMessage('agent', msgs[access.reason] || 'Sin acceso a Claude en este momento.');
        return;
      }
    }

    if (input && !overrideText) {
      input.value = '';
      input.style.height = 'auto';
    }

    appendMessage('user', text);
    showTyping();
    setClippyTalking(true);

    document.getElementById('mtx-agent-send').disabled = true;
    isTyping = true;

    const reply = await callClaude(text);

    hideTyping();
    setClippyTalking(false);
    appendMessage('agent', reply);

    // Incrementar uso Claude si la llamada fue exitosa
    if (currentUser?.id && typeof incrementClaudeUsage === 'function' && reply && !reply.startsWith('Ocurrió un error')) {
      incrementClaudeUsage(currentUser.id).catch(() => {});
    }

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
      ? `<div class="msg-avatar clippy-msg">${clippySVG('clippy-msg-' + Date.now())}</div>`
      : `<div class="msg-avatar" style="border-radius:50%;background:#0055ff;color:#fff;font-size:11px;font-weight:700;width:28px;height:28px;">${initials}</div>`;

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
      <div class="msg-avatar clippy-msg">${clippySVG('clippy-typing')}</div>
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
