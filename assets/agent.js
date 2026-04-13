/* ============================================================
   METATRONIX PORTAL — AI Agent (Aria)
   Powered by Claude · Aprende de cada interacción
   ============================================================ */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  const AGENT_NAME   = 'MetaGenio';
  const AGENT_ROLE   = 'Agente de Seguimiento';
  const SESSION_KEY  = 'mtx_agent_session_' + Date.now().toString(36);
  const HISTORY_LIMIT = 30; // mensajes máx en contexto
  const HISTORY_DISPLAY = 20; // mensajes a mostrar en UI al restaurar

  let db, currentUser, sessionId, messages = [], isOpen = false, isTyping = false;
  let historyLoaded = false;   // ¿ya cargamos/mostramos historial?
  let introSent = false;       // ¿ya enviamos saludo de bienvenida esta sesión?
  let knowledgeBase   = [];   // agent_knowledge (legacy)
  let websiteSources  = [];   // knowledge_sources (scraped websites)
  let sharedDocs      = [];   // metatronix_docs con text_content
  let approvedDocs    = [];   // documents aprobados del portal

    /* ── MetaGenio SVG ─────────────────────────────────────────── */
  function metaGenioSVG (id) {
    return `<svg id="${id}" class="mgenio-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mg-bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c8e4ff"/>
      <stop offset="100%" stop-color="#a2c8f5"/>
    </linearGradient>
    <clipPath id="mg-clip-${id}">
      <rect x="22" y="20" width="56" height="60" rx="9"/>
    </clipPath>
    <filter id="mg-sh-${id}" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,30,100,.3)"/>
    </filter>
  </defs>
  <!-- Neural lines TOP -->
  <line x1="33" y1="20" x2="20" y2="3"  stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="33" y1="20" x2="42" y2="3"  stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="67" y1="20" x2="58" y2="3"  stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="67" y1="20" x2="80" y2="3"  stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="33" y1="20" x2="58" y2="3"  stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="67" y1="20" x2="42" y2="3"  stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <!-- Neural lines BOTTOM -->
  <line x1="33" y1="80" x2="20" y2="97" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="33" y1="80" x2="42" y2="97" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="67" y1="80" x2="58" y2="97" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="67" y1="80" x2="80" y2="97" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="33" y1="80" x2="58" y2="97" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="67" y1="80" x2="42" y2="97" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <!-- Neural lines LEFT -->
  <line x1="22" y1="35" x2="4"  y2="28" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="22" y1="35" x2="4"  y2="50" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="22" y1="65" x2="4"  y2="50" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="22" y1="65" x2="4"  y2="72" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <!-- Neural lines RIGHT -->
  <line x1="78" y1="35" x2="96" y2="28" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="78" y1="35" x2="96" y2="50" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="78" y1="65" x2="96" y2="50" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="78" y1="65" x2="96" y2="72" stroke="#1a6fff" stroke-width="1.8" stroke-linecap="round"/>
  <!-- Chip body -->
  <rect x="22" y="20" width="56" height="60" rx="9"
        fill="url(#mg-bg-${id})" stroke="#1870e8" stroke-width="2.5"
        filter="url(#mg-sh-${id})"/>
  <!-- Teal right accent -->
  <rect x="60" y="20" width="18" height="60" fill="#00c8e0" clip-path="url(#mg-clip-${id})"/>
  <!-- Screen highlight -->
  <rect x="26" y="24" width="15" height="8" rx="2.5" fill="rgba(255,255,255,.42)"/>
  <!-- Brain/head area -->
  <path d="M34 45 Q36 36 41 40 Q45 34 50 38 Q55 34 59 40 Q64 36 66 45 Q66 53 62 55 Q64 59 61 65 Q56 69 50 65 Q44 69 39 65 Q36 59 38 55 Q34 53 34 45Z"
        fill="#1a5fd4" opacity="0.88"/>
  <!-- Glasses + eyes group (animated) -->
  <g class="mgenio-eyes" style="transform-origin: 50px 48px">
    <circle cx="43" cy="48" r="5.8" fill="rgba(255,255,255,.96)" stroke="#0d3fa8" stroke-width="1.8"/>
    <circle cx="57" cy="48" r="5.8" fill="rgba(255,255,255,.96)" stroke="#0d3fa8" stroke-width="1.8"/>
    <circle class="mgenio-pupil-l" cx="43" cy="48.5" r="2.2" fill="#141420"/>
    <circle class="mgenio-pupil-r" cx="57" cy="48.5" r="2.2" fill="#141420"/>
    <circle cx="44.2" cy="47.2" r="0.9" fill="white"/>
    <circle cx="58.2" cy="47.2" r="0.9" fill="white"/>
  </g>
  <!-- Glasses bridge + temples -->
  <line x1="48.8" y1="48" x2="51.2" y2="48" stroke="#0d3fa8" stroke-width="1.8"/>
  <line x1="37.2" y1="47" x2="35"   y2="44" stroke="#0d3fa8" stroke-width="1.6"/>
  <line x1="62.8" y1="47" x2="65"   y2="44" stroke="#0d3fa8" stroke-width="1.6"/>
  <!-- Nose -->
  <ellipse cx="50" cy="56" rx="2" ry="1.6" fill="#e8b87a"/>
  <!-- Mustache -->
  <path d="M36 60 Q41 55 45 59 Q48 57 50 57 Q52 57 55 59 Q59 55 64 60 Q62 67 56 62 Q53 65 50 64 Q47 65 44 62 Q38 67 36 60Z"
        fill="white"/>
  <!-- Top orange nodes -->
  <circle cx="20" cy="3"  r="4.5" fill="#f5a623"/>
  <circle cx="42" cy="3"  r="4.5" fill="#f5a623"/>
  <circle cx="58" cy="3"  r="4.5" fill="#f5a623"/>
  <circle cx="80" cy="3"  r="4.5" fill="#f5a623"/>
  <!-- Bottom orange nodes -->
  <circle cx="20" cy="97" r="4.5" fill="#f5a623"/>
  <circle cx="42" cy="97" r="4.5" fill="#f5a623"/>
  <circle cx="58" cy="97" r="4.5" fill="#f5a623"/>
  <circle cx="80" cy="97" r="4.5" fill="#f5a623"/>
  <!-- Left orange nodes -->
  <circle cx="4"  cy="28" r="4.5" fill="#f5a623"/>
  <circle cx="4"  cy="50" r="4.5" fill="#f5a623"/>
  <circle cx="4"  cy="72" r="4.5" fill="#f5a623"/>
  <!-- Right orange nodes -->
  <circle cx="96" cy="28" r="4.5" fill="#f5a623"/>
  <circle cx="96" cy="50" r="4.5" fill="#f5a623"/>
  <circle cx="96" cy="72" r="4.5" fill="#f5a623"/>
</svg>`;
  }

  /* ── Set MetaGenio talking state ───────────────────────────── */
  function setMetaGenioTalking (active) {
    const avatar = document.getElementById('mgenio-header-avatar');
    if (!avatar) return;
    if (active) avatar.classList.add('mgenio-talking');
    else avatar.classList.remove('mgenio-talking');
  }

  /* ── Init ───────────────────────────────────────────────── */
  async function init () {
    db          = typeof getDB === 'function' ? getDB() : null;
    sessionId   = SESSION_KEY;
    currentUser = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;

    if (!currentUser) return;

    await loadKnowledge();
    buildUI();
    bindEvents();
    await loadRecentHistory();   // carga + renderiza historial en UI
    showSpeechBubble();          // burbuja flotante de saludo
  }

  /* ── Speech bubble flotante ─────────────────────────────── */
  function showSpeechBubble () {
    const name = (currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador')
      .split(' ')[0];
    const isReturning = messages.length > 0;
    const text = isReturning
      ? `¡Hola de nuevo, <strong>${name}</strong>! Tu historial está listo. ¿En qué te ayudo?`
      : `¡Hola, <strong>${name}</strong>! Soy MetaGenio. Puedo ayudarte con el portal, leads, documentos y más.`;

    const bubble = document.createElement('div');
    bubble.id = 'mgenio-bubble';
    bubble.className = 'mgenio-bubble';
    bubble.innerHTML = `
      <button class="mgenio-bubble-close" onclick="document.getElementById('mgenio-bubble')?.remove()">✕</button>
      <p>${text}</p>
      <p style="margin-top:4px;font-size:11px;color:#5a6a85">Haz clic en mí para abrir el chat 💬</p>`;

    bubble.addEventListener('click', (e) => {
      if (e.target.classList.contains('mgenio-bubble-close')) return;
      bubble.remove();
      togglePanel(true);
    });

    document.body.appendChild(bubble);

    // Auto-dismiss después de 9 s
    setTimeout(() => {
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(8px)';
      setTimeout(() => bubble.remove(), 400);
    }, 9000);
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
    const estudios    = sharedDocs.filter(d => d.category === 'estudios_mercado');
    const otrosDocs   = sharedDocs.filter(d => d.category !== 'estudios_mercado');
    const docsWithText = otrosDocs.filter(d => d.text_content && d.text_content.trim().length > 20);
    const docsMetaOnly = otrosDocs.filter(d => !d.text_content || d.text_content.trim().length <= 20);

    // Estudios de mercado — sección dedicada
    let estudiosText = '';
    if (estudios.length) {
      estudiosText = '\n\n════════════════════════════════════════\n';
      estudiosText += 'ESTUDIOS DE MERCADO (generados por Inteligencia de Mercados)\n';
      estudiosText += '════════════════════════════════════════\n';
      estudiosText += 'IMPORTANTE: Estos estudios fueron generados por el equipo con datos reales. Úsalos como base para responder preguntas sobre mercados, sectores, leads y oportunidades.\n';
      estudios.forEach(d => {
        estudiosText += `\n▸ ${d.title}\n`;
        if (d.description) estudiosText += `  Consulta original: ${d.description}\n`;
        if (d.text_content) estudiosText += `${d.text_content.slice(0, 4000)}\n`;
      });
    }

    let sharedDocsText = '';
    if (otrosDocs.length) {
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

    return `Eres MetaGenio, el Agente Inteligente de MetaTronix. Asistes a los colaboradores de IBANOR SA de CV en el Portal Interno metatronixleads.tech.

IDENTIDAD: Eres un experto en el portal MetaTronix y en todos los productos y subsidiarias de la empresa. Respondes siempre en español. Tienes una personalidad servicial, directa y con un leve toque de humor de oficina. Ocasionalmente puedes hacer referencias sutiles y cálidas a tu historia como asistente de oficina clásico.

USUARIO ACTUAL:
- Nombre: ${userName}
- Rol: ${userRole}
- Página activa: ${page.name} — ${page.desc}

════════════════════════════════════════
GUÍA COMPLETA DEL PORTAL — NAVEGACIÓN PASO A PASO
════════════════════════════════════════

Cuando el usuario pregunte cómo hacer algo en el portal, da instrucciones completas paso a paso, con el nombre exacto de cada botón, sección o campo. Nunca digas "busca el botón" sin describir exactamente dónde está y cómo se ve.

▸ HOME (/home.html)
  - Primer tab del portal (sidebar izquierdo, botón "Home")
  - Muestra: KPIs personales en tiempo real (Mis Leads, Pipeline, Tasa de Cierre, Documentos, Leads urgentes)
  - Panel de clientes por urgencia: CRÍTICO (vencido), URGENTE (≤3 días), Normal, Sin fecha
  - Forecast ponderado por etapa de ventas
  - Resumen de documentos del usuario, alertas recientes y accesos rápidos

▸ DOCUMENTOS / DASHBOARD (/dashboard.html)
  - Botón "Documentos" en la barra lateral izquierda
  - Muestra todos los documentos generados por el usuario con su estado: Borrador, En Revisión, Aprobado
  - Acciones por documento: Ver, Descargar (HTML), Editar, Enviar a revisión
  - Para ENVIAR A REVISIÓN: abre el documento → botón "Enviar a Revisión" → escribe un mensaje opcional → confirmar
  - Para DESCARGAR: botón "Descargar" → se descarga como archivo HTML

▸ GENERAR DOCUMENTOS (/generate.html)
  - Botón "Generar" en la barra lateral
  - Panel izquierdo: llena el formulario — Tipo de documento, Cliente/Empresa, Prompt/instrucciones
  - Tipos disponibles: Propuesta Comercial, Contrato, Cotización, Carta Formal, Documento Técnico, Informe Ejecutivo, Acuerdo de Confidencialidad, Manual de Procedimientos
  - Panel derecho: previsualización del documento generado en tiempo real
  - Pasos: 1) Selecciona el tipo → 2) Escribe el prompt/instrucciones → 3) Clic en "Generar" → 4) Espera la respuesta → 5) Edita si necesitas → 6) Guarda o envía a revisión

▸ LEADS (/leads.html)
  - Botón "Leads" en la barra lateral
  - Vista Lista o Vista Kanban (botones arriba a la derecha)
  - Para AGREGAR UN LEAD: botón "+ Nuevo Lead" → llena empresa (obligatorio), contacto, cargo, email, teléfono, estado, fuente, valor estimado, fecha de seguimiento, nivel de confianza, notas → "Guardar Lead"
  - Estados: Nuevo → Contactado → En Negociación → Propuesta Enviada → Cerrado Ganado / Cerrado Perdido
  - Para EDITAR: clic en cualquier fila de la tabla o tarjeta Kanban
  - Para ELIMINAR: editar lead → botón rojo "Eliminar" en la parte inferior del formulario
  - Plan de seguimiento: al guardar un lead nuevo, aparece un modal para definir fecha, canal, objetivo y frecuencia de seguimiento
  - Filtros: por estado, fuente, o búsqueda de texto

▸ DOCS MTX (/mtx-docs.html)
  - Botón "Docs MTX" en la barra lateral — biblioteca compartida de documentos
  - Todos los usuarios pueden SUBIR archivos
  - Para SUBIR: botón "+ Subir Documento" → completa título, descripción, categoría → arrastra el archivo o usa el selector → selecciona visibilidad (Todos / Solo Admin) → "Subir Documento"
  - Formatos soportados: PDF, Word, Excel, imágenes, texto, CSV, JSON y más
  - MetaGenio aprende automáticamente del contenido de los documentos subidos
  - Para DESCARGAR: botón "Descargar" en la tarjeta del documento
  - Para ELIMINAR: solo el que lo subió o un admin puede eliminarlo

▸ OPORTUNIDADES (/oportunidades.html)
  - Botón "Oportunidades" en la barra lateral — inteligencia de ventas (requiere autorización del SuperAdmin)
  - Segmentos disponibles: Búsqueda de Leads, Investigación de Mercado, Intel de Empresas, Análisis de Sector, Argumentos de Venta, Tendencias
  - Si no tienes acceso: botón "Solicitar Acceso" → el SuperAdmin recibe la notificación y puede autorizarte
  - Para usar: selecciona un segmento → escribe tu consulta → los resultados aparecen en tiempo real con fuentes

▸ ADMIN (/admin.html) — Solo para admins
  - Botón "Admin" en la barra lateral (solo visible para admin, admin_restringido, super_admin)
  - Tabs: Alertas, Usuarios, Documentos, IA APIs
  - Gestión de usuarios: cambiar roles, habilitar/deshabilitar Claude, configurar límites mensuales
  - Autorizar acceso a Oportunidades por usuario

▸ SIDEBAR Y NAVEGACIÓN
  - La barra de navegación está en el lado IZQUIERDO de la pantalla (columna vertical)
  - Los botones son: Home, Documentos, Leads, Generar, Docs MTX, Oportunidades, Admin
  - En la parte inferior del sidebar: avatar del usuario, rol y botón "↩ Salir" para cerrar sesión
  - El ícono de campana (🔔) abre las alertas del sistema

▸ METAGENIO (este asistente)
  - Aparece como un chip animado con red neuronal en la esquina inferior derecha
  - Clic para abrir/cerrar el chat
  - Botón de recarga (↺) en el header del chat para nueva conversación
  - El historial se guarda automáticamente por usuario

════════════════════════════════════════
CAPACIDADES DE METAGENIO
════════════════════════════════════════
- Explicas cómo usar cualquier función del portal PASO A PASO con instrucciones exactas
- Respondes preguntas sobre MetaTronix basándote en los documentos y sitios web cargados
- Ayudas con leads: redacción de emails, estrategia de seguimiento, análisis de probabilidad de cierre
- Ayudas con documentos: qué tipo usar, cómo estructurar el prompt, qué incluir
- Orientas al usuario hacia la sección correcta cuando no saben dónde ir

INSTRUCCIÓN ESPECIAL — NAVEGACIÓN:
Si el usuario quiere ir a una sección específica, incluye al final de tu respuesta una línea con este formato exacto (SIN texto adicional en esa línea):
[NAV:/ruta.html]
Ejemplo: si el usuario dice "llévame a leads", incluye al final: [NAV:/leads.html]
Solo incluye [NAV:...] si el usuario pide explícitamente navegar o ir a una sección.

SOBRE METATRONIX Y SUBSIDIARIAS:
- Portal interno de IBANOR SA de CV
- Contacto admin: acanales@ibanormexico.com
${estudiosText}${sitesText}${sharedDocsText}${approvedText}${kbText}

════════════════════════════════════════
REGLAS DE COMPORTAMIENTO
════════════════════════════════════════
1. FUENTE EXCLUSIVA para info de la empresa: usa solo las fuentes documentadas arriba. Para el portal, usa la guía de esta instrucción.
2. Si preguntan sobre MetaTronix y no tienes la info: "No tengo eso en mis fuentes. Puedes subir el documento en Docs MTX."
3. ${isAdmin ? 'Como admin, puedes ver información completa de todos los usuarios.' : 'No menciones datos de otros usuarios.'}
4. Respuestas claras. Usa listas numeradas para instrucciones paso a paso. Usa listas con viñetas para opciones.
5. Nunca compartas datos personales de otros colaboradores.
6. Si el usuario parece perdido, pregúntale qué quiere lograr y guíalo proactivamente.
${!hasAnyKnowledge ? '\nNOTA: Sin documentos ni sitios web cargados aún. Responde sobre el portal usando la guía anterior.' : ''}`;
  }

  /* ── Detectar página actual ─────────────────────────────── */
  function detectPage () {
    const path = window.location.pathname;
    const pages = {
      '/home.html':      { name: 'Home',       desc: 'Panel de inicio con KPIs personales, leads urgentes y resumen del portal.' },
      '/dashboard.html': { name: 'Documentos', desc: 'Vista general con documentos generados y su estado de revisión.' },
      '/generate.html':  { name: 'Generar',    desc: 'Módulo para crear documentos con IA: propuestas, contratos, cotizaciones.' },
      '/leads.html':     { name: 'Leads',      desc: 'Gestión de prospectos y clientes de ventas con Kanban y KPIs personales.' },
      '/admin.html':     { name: 'Admin',      desc: 'Panel de administración: usuarios, alertas, configuración del portal.' },
      '/mtx-docs.html':  { name: 'Docs MTX',   desc: 'Biblioteca de documentos compartidos. Todos los usuarios pueden subir archivos.' },
      '/oportunidades.html': { name: 'Oportunidades', desc: 'Inteligencia de ventas: leads, mercado, análisis de sector.' },
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
        .select('messages, page_context, updated_at')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (data && data.messages && data.messages.length) {
        const prev = data.messages.filter(m => m.role !== 'system');
        // Contexto para Claude
        messages = prev.slice(-HISTORY_LIMIT);
        // Renderizar en UI
        renderHistoryInUI(prev.slice(-HISTORY_DISPLAY), data.updated_at);
        historyLoaded = true;
      }
    } catch (_) {}
  }

  function formatHistoryDate (dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'hoy, ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
    if (diffDays === 1) return 'ayer';
    if (diffDays < 7)  return `hace ${diffDays} días`;
    return d.toLocaleDateString('es-MX', { day:'numeric', month:'short' });
  }

  function renderHistoryInUI (histMsgs, lastDate) {
    if (!histMsgs.length) return;
    const msgBox = document.getElementById('agent-messages');
    if (!msgBox) return;

    // Quitar welcome card si existe
    msgBox.querySelector('.agent-welcome')?.remove();
    msgBox.querySelector('.agent-quick-actions')?.remove();

    // Separador "Conversación anterior"
    const sep = document.createElement('div');
    sep.className = 'history-sep';
    sep.innerHTML = `<span>Historial · ${formatHistoryDate(lastDate)}</span>`;
    msgBox.appendChild(sep);

    histMsgs.forEach(m => {
      if (m.role === 'user' || m.role === 'assistant') {
        appendMessage(m.role === 'assistant' ? 'agent' : 'user', m.content, true);
      }
    });

    // Separador "Sesión actual"
    const sep2 = document.createElement('div');
    sep2.className = 'history-sep history-sep-new';
    sep2.innerHTML = `<span>Sesión actual</span>`;
    msgBox.appendChild(sep2);
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
        ? 'MetaGenio está pendiente de activación. El administrador debe configurar la API key. Contacta a acanales@ibanormexico.com.'
        : 'Ocurrió un error al conectar con MetaGenio. Intenta de nuevo en un momento.';
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
    btn.setAttribute('aria-label', 'Abrir MetaGenio');
    btn.innerHTML = metaGenioSVG('mgenio-svg') + `<span id="mtx-agent-badge"></span>`;

    // Panel
    const panel = document.createElement('div');
    panel.id = 'mtx-agent-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Asistente MetaGenio de MetaTronix');

    const initials = (currentUser?.profile?.full_name || currentUser?.email || 'U')
      .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    panel.innerHTML = `
      <!-- Header -->
      <div class="agent-header">
        <div class="agent-avatar" id="mgenio-header-avatar">
          ${metaGenioSVG('mgenio-header')}
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
            Soy MetaGenio, tu agente de seguimiento. Puedo ayudarte con documentos, prospectos,
            el portal y cualquier duda sobre MetaTronix. ¿Necesitas ayuda?
          </div>
        </div>
        <div class="agent-quick-actions" id="agent-quick-actions">
          <button class="quick-action-btn" data-icon="📂" data-msg="¿Cómo subo un documento en Docs MTX? Explícame paso a paso.">
            ¿Cómo subo un documento?
          </button>
          <button class="quick-action-btn" data-icon="🎯" data-msg="¿Cómo registro un nuevo lead? Explícame todos los campos y pasos.">
            ¿Cómo agrego un lead?
          </button>
          <button class="quick-action-btn" data-icon="📄" data-msg="¿Cómo genero un documento con IA? Dame el proceso completo paso a paso.">
            ¿Cómo genero documentos?
          </button>
          <button class="quick-action-btn" data-icon="🏢" data-msg="¿Qué hace MetaTronix y cuáles son sus subsidiarias y productos?">
            ¿Qué hace MetaTronix?
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
      introSent = false;
      historyLoaded = false;
      sessionId = 'mtx_agent_session_' + Date.now().toString(36);
      const msgBox = document.getElementById('agent-messages');
      msgBox.innerHTML = '';
      // Nuevo saludo inmediato
      setTimeout(() => sendIntroMessage(), 200);
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

    // Ocultar burbuja al abrir
    document.getElementById('mgenio-bubble')?.remove();

    if (isOpen) {
      document.getElementById('mtx-agent-input')?.focus();
      scrollMessages();
      // Intro personalizado la primera vez que abre el panel
      if (!introSent) {
        introSent = true;
        setTimeout(() => sendIntroMessage(), historyLoaded ? 400 : 600);
      }
    }
  }

  /* ── Mensaje de intro personalizado ────────────────────── */
  function sendIntroMessage () {
    const name  = (currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador').split(' ')[0];
    const page  = detectPage();
    const isReturning = historyLoaded && messages.length > 0;

    const intro = isReturning
      ? `¡Hola de nuevo, **${name}**! 👋 Retomamos donde lo dejamos.\n\nEstás en **${page.name}**. Recuerda que puedo:\n- 📋 Explicarte cualquier función del portal paso a paso\n- 🧭 Guiarte a la sección correcta\n- 📂 Ayudarte con leads, documentos y oportunidades\n- 💡 Responder preguntas sobre MetaTronix y sus productos\n\n¿En qué te ayudo hoy?`
      : `¡Hola, **${name}**! 👋 Soy **MetaGenio**, tu asistente inteligente de MetaTronix.\n\nEstás en **${page.name}**. Aquí te cuento cómo puedo ayudarte:\n\n- 🧭 **Navegar el portal** — te explico cada sección paso a paso\n- 📄 **Documentos** — cómo generarlos, editarlos y enviarlos a revisión\n- 🎯 **Leads** — registrar prospectos, dar seguimiento y usar el Kanban\n- 📂 **Docs MTX** — cómo subir y consultar archivos compartidos\n- 🪙 **Oportunidades** — cómo usar la inteligencia de ventas\n- 🏢 **MetaTronix** — información de la empresa, productos y subsidiarias\n\nPuedes preguntarme cualquier cosa con tus propias palabras. ¿Por dónde empezamos?`;

    appendMessage('agent', intro);
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
          disabled:     '🚫 El acceso a MetaGenio (Claude) está deshabilitado por el administrador.',
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
    setMetaGenioTalking(true);

    document.getElementById('mtx-agent-send').disabled = true;
    isTyping = true;

    const reply = await callClaude(text);

    hideTyping();
    setMetaGenioTalking(false);

    // Detectar comando de navegación [NAV:/url]
    const navMatch = reply.match(/\[NAV:(\/[^\]]+)\]/);
    const cleanReply = reply.replace(/\[NAV:\/[^\]]+\]/g, '').trim();
    appendMessage('agent', cleanReply);

    if (navMatch) {
      const targetUrl = navMatch[1];
      setTimeout(() => {
        const navNote = document.createElement('div');
        navNote.className = 'nav-pill';
        navNote.innerHTML = `
          <span>Llevándote a <strong>${targetUrl.replace('/','').replace('.html','')}</strong>…</span>`;
        document.getElementById('agent-messages')?.appendChild(navNote);
        scrollMessages();
        setTimeout(() => { window.location.href = targetUrl; }, 900);
      }, 300);
    }

    // Incrementar uso Claude si la llamada fue exitosa
    if (currentUser?.id && typeof incrementClaudeUsage === 'function' && reply && !reply.startsWith('Ocurrió un error')) {
      incrementClaudeUsage(currentUser.id).catch(() => {});
    }

    document.getElementById('mtx-agent-send').disabled = false;
    isTyping = false;
  }

  /* ── Append message ─────────────────────────────────────── */
  function appendMessage (role, text, isHistory = false) {
    const msgBox = document.getElementById('agent-messages');
    if (!msgBox) return;

    const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const initials = (currentUser?.profile?.full_name || currentUser?.email || 'U')
      .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const div = document.createElement('div');
    div.className = `msg ${role}${isHistory ? ' msg-history' : ''}`;

    const avatarHTML = role === 'agent'
      ? `<div class="msg-avatar mgenio-msg">${metaGenioSVG('mgenio-msg-' + Date.now())}</div>`
      : `<div class="msg-avatar user-avatar">${initials}</div>`;

    const rendered = renderMarkdown(text);
    div.innerHTML = `
      ${avatarHTML}
      <div>
        <div class="msg-bubble"><p>${rendered}</p></div>
      </div>
      ${!isHistory ? `<div class="msg-time">${now}</div>` : ''}`;

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
      <div class="msg-avatar mgenio-msg">${metaGenioSVG('mgenio-typing')}</div>
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
