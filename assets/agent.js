/* ============================================================
   METATRONIX PORTAL â AI Agent (Aria)
   Powered by Claude Â· Aprende de cada interacciÃ³n
   ============================================================ */

(function () {
  'use strict';

  /* ââ Inline agent styles (sync â no async fetch race) âââââ */
  (function injectAgentStyles() {
    if (document.getElementById('mtx-agent-styles')) return;
    const s = document.createElement('style');
    s.id = 'mtx-agent-styles';
    s.textContent = [
      '@keyframes mgenio-idle{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-6px) scale(1.02)}60%{transform:translateY(-9px) scale(1.03)}80%{transform:translateY(-5px) scale(1.01)}100%{transform:translateY(0) scale(1)}}',
      '@keyframes mgenio-talk{0%,100%{transform:scale(1) translateY(0)}15%{transform:scale(1.06) translateY(-5px)}35%{transform:scale(.97) translateY(-2px)}55%{transform:scale(1.04) translateY(-6px)}75%{transform:scale(.98) translateY(-1px)}}',
      '@keyframes mgenio-blink{0%,88%,100%{transform:scaleY(1)}93%{transform:scaleY(.06)}}',
      '@keyframes mgenio-pupil-idle{0%,40%{transform:translate(0,0)}45%,75%{transform:translate(2px,-1px)}80%,100%{transform:translate(-1px,1px)}}',
      '@keyframes status-blink{0%,100%{opacity:1}50%{opacity:.4}}',
      '@keyframes typing-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',
      '@keyframes bubble-appear{0%{opacity:0;transform:translateY(12px) scale(.92)}100%{opacity:1;transform:translateY(0) scale(1)}}',
      '@keyframes nav-pulse{0%,100%{opacity:1}50%{opacity:.6}}',
      '#mtx-agent-btn{position:fixed!important;bottom:16px!important;right:20px!important;z-index:9000!important;width:88px!important;height:88px!important;background:transparent;border:none;cursor:grab;outline:none;padding:0;filter:drop-shadow(0 6px 16px rgba(0,0,0,.28));animation:mgenio-idle 3.2s ease-in-out infinite;transition:filter .2s;user-select:none;touch-action:none}',
      '#mtx-agent-btn:hover{filter:drop-shadow(0 8px 20px rgba(0,0,0,.38)) brightness(1.06);animation-duration:1.8s}',
      '#mtx-agent-btn.dragging{cursor:grabbing;animation:none;opacity:.9}',
      '#mtx-agent-btn.open{animation:mgenio-talk 0.6s ease-in-out infinite;filter:drop-shadow(0 6px 18px rgba(0,85,255,.32))}',
      '#mtx-agent-btn .mgenio-svg{width:100%;height:100%}',
      '#mtx-agent-btn .mgenio-pupil-l,#mtx-agent-btn .mgenio-pupil-r{animation:mgenio-pupil-idle 4s ease-in-out infinite}',
      '#mtx-agent-btn .mgenio-eyes{animation:mgenio-blink 4s ease-in-out infinite;transform-origin:center 38px}',
      '#mtx-agent-btn.open .mgenio-pupil-l,#mtx-agent-btn.open .mgenio-pupil-r{transform:translate(-3px,1px);animation:none}',
      '#mtx-agent-badge{position:absolute;top:2px;right:0;width:18px;height:18px;border-radius:50%;background:#e03030;border:2px solid #fff;font-size:10px;color:#fff;font-weight:700;display:none;align-items:center;justify-content:center}',
      '#mtx-agent-badge.show{display:flex}',
      '#mtx-agent-panel{position:fixed!important;bottom:112px!important;right:20px!important;z-index:8999!important;width:380px;height:560px;max-height:calc(100vh - 120px);border-radius:16px;background:#161C2A;border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.6);transform:scale(.92) translateY(16px);transform-origin:bottom right;opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s}',
      '#mtx-agent-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all}',
      '.agent-header{display:flex;align-items:center;gap:12px;padding:16px 18px;background:linear-gradient(135deg,#0C0F17,#141922);border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}',
      '.agent-avatar{width:52px;height:52px;background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.22));animation:mgenio-idle 3s ease-in-out infinite}',
      '.agent-avatar svg{width:52px;height:52px}',
      '.agent-avatar.mgenio-talking{animation:mgenio-talk .5s ease-in-out infinite!important}',
      '.agent-header-info{flex:1}.agent-name{font-size:14px;font-weight:600;color:#fff;font-family:"DM Sans",sans-serif;line-height:1.2}',
      '.agent-status{display:flex;align-items:center;gap:5px;font-size:11px;color:rgba(255,255,255,.75);font-family:"DM Sans",sans-serif}',
      '.agent-status-dot{width:6px;height:6px;border-radius:50%;background:#4dffa0;animation:status-blink 2s ease-in-out infinite}',
      '.agent-header-actions{display:flex;gap:4px}',
      '.agent-header-btn{background:rgba(255,255,255,.15);border:none;border-radius:6px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;transition:background .15s}',
      '.agent-header-btn:hover{background:rgba(255,255,255,.25)}',
      '.agent-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}',
      '.agent-messages::-webkit-scrollbar{width:4px}.agent-messages::-webkit-scrollbar-track{background:transparent}.agent-messages::-webkit-scrollbar-thumb{background:#dde3ec;border-radius:2px}',
      '.msg{display:flex;gap:8px;align-items:flex-end;max-width:90%}.msg.user{flex-direction:row-reverse;margin-left:auto}',
      '.msg-avatar{width:32px;height:38px;background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px}',
      '.msg-avatar.mgenio-msg{filter:drop-shadow(0 1px 3px rgba(0,0,0,.18))}',
      '.msg-avatar svg{width:32px;height:38px}',
      '.msg.user .msg-avatar{background:linear-gradient(135deg,#0C0F17,#141922);color:#fff;font-size:11px;font-weight:700}',
      '.msg-bubble{padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.55;font-family:"DM Sans",sans-serif;color:#1a2233}',
      '.msg.agent .msg-bubble{background:#f1f4f8;border-bottom-left-radius:4px}',
      '.msg.user .msg-bubble{background:linear-gradient(135deg,#0C0F17,#141922);color:#fff;border-bottom-right-radius:4px}',
      '.msg-bubble p{margin-bottom:6px}.msg-bubble p:last-child{margin-bottom:0}.msg-bubble strong{font-weight:600}',
      '.msg-bubble ul,.msg-bubble ol{padding-left:16px;margin:4px 0}.msg-bubble li{margin-bottom:3px}',
      '.msg-bubble a{color:#0055ff;text-decoration:underline}.msg.user .msg-bubble a{color:rgba(255,255,255,.85)}',
      '.msg-time{font-size:10px;color:#a8b5c8;text-align:center;align-self:flex-end;flex-shrink:0;margin-bottom:2px;font-family:"JetBrains Mono",monospace}',
      '.typing-indicator{display:flex;gap:8px;align-items:flex-end}',
      '.typing-dots{background:#f1f4f8;border-radius:14px;border-bottom-left-radius:4px;padding:10px 14px;display:flex;gap:4px;align-items:center}',
      '.typing-dots span{width:6px;height:6px;border-radius:50%;background:#a8b5c8;animation:typing-bounce .9s ease-in-out infinite}',
      '.typing-dots span:nth-child(2){animation-delay:.15s}.typing-dots span:nth-child(3){animation-delay:.3s}',
      '.agent-mode-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.08);background:#0f1623;flex-shrink:0}',
      '.mode-tab{flex:1;padding:7px 4px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.35);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all .15s;font-family:var(--font-mono,monospace)}',
      '.mode-tab:hover{color:rgba(255,255,255,.7)}.mode-tab.active{color:#1a6fff;border-bottom-color:#1a6fff}',
      '.mode-tab[data-mode="metafollow"].active{color:#00c853;border-bottom-color:#00c853}',
      '.mode-tab[data-mode="dalipx"].active{color:#ff6d00;border-bottom-color:#ff6d00}',
      '.agent-welcome{background:linear-gradient(135deg,#f0f4ff,#e8eeff);border:1px solid #c8d8ff;border-radius:12px;padding:14px 16px;margin-bottom:4px}',
      '.agent-welcome-title{font-size:13px;font-weight:600;color:#0055ff;margin-bottom:4px}.agent-welcome-text{font-size:12px;color:#5a6a85;line-height:1.5}',
      '.agent-quick-actions{display:flex;flex-direction:column;gap:6px;margin-top:8px}',
      '.quick-action-btn{background:#161C2A;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 12px;font-size:12px;color:#1a2233;cursor:pointer;text-align:left;transition:border-color .15s,background .15s;font-family:"DM Sans",sans-serif;display:flex;align-items:center;gap:8px}',
      '.quick-action-btn:hover{border-color:#0055ff;background:#f0f4ff;color:#0055ff}.quick-action-btn::before{content:attr(data-icon);font-size:14px}',
      '.agent-input-area{padding:12px 14px;border-top:1px solid #eef0f4;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;background:#161C2A}',
      '#mtx-agent-input{flex:1;background:#1C2236;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 12px;font-size:13px;color:#E8EDF8;outline:none;resize:none;max-height:100px;min-height:38px;font-family:"DM Sans",sans-serif;line-height:1.4;transition:border-color .15s,background .15s}',
      '#mtx-agent-input:focus{background:#161C2A;border-color:#0055ff;color:#E8EDF8}',
      '#mtx-agent-input::placeholder{color:#a8b5c8}#mtx-agent-input:focus::placeholder{color:#5a7090}',
      '#mtx-agent-send{width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#0C0F17,#141922);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,transform .1s}',
      '#mtx-agent-send:hover{background:#0044dd}#mtx-agent-send:active{transform:scale(.93)}#mtx-agent-send:disabled{background:#c8d1de;cursor:not-allowed}',
      '#mtx-agent-send svg{width:16px;height:16px;color:#fff}',
      '.agent-footer-note{text-align:center;font-size:10px;color:#c8d1de;padding:0 14px 10px;font-family:"JetBrains Mono",monospace;letter-spacing:.04em}',
      '.msg-avatar.user-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0C0F17,#141922);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.mgenio-bubble{position:fixed;bottom:108px;right:106px;z-index:9001;background:#161C2A;border:1.5px solid #dde3ec;border-radius:14px;padding:12px 14px 10px;max-width:210px;box-shadow:0 6px 24px rgba(0,30,80,.14);font-family:"DM Sans",sans-serif;font-size:13px;color:#1a2233;line-height:1.45;cursor:pointer;animation:bubble-appear .35s cubic-bezier(.34,1.56,.64,1);transition:opacity .35s,transform .35s}',
      '.mgenio-bubble p{margin:0}',
      '.mgenio-bubble-close{position:absolute;top:6px;right:7px;background:none;border:none;font-size:11px;color:#a8b5c8;cursor:pointer;padding:2px 4px;line-height:1;transition:color .15s}',
      '.mgenio-bubble-close:hover{color:#5a6a85}',
      '.history-sep{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:10px;color:#a8b5c8;font-family:"JetBrains Mono",monospace;letter-spacing:.04em}',
      '.history-sep::before,.history-sep::after{content:"";flex:1;height:1px;background:#eef0f4}',
      '.history-sep-new span{color:#0055ff}.history-sep-new::before,.history-sep-new::after{background:rgba(0,85,255,.15)}',
      '.msg.msg-history .msg-bubble{opacity:.75}',
      '.nav-pill{display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#f0f4ff,#e8eeff);border:1px solid #c8d8ff;border-radius:20px;padding:8px 14px;font-size:12px;color:#0055ff;font-family:"DM Sans",sans-serif}',
      '@media(max-width:480px){#mtx-agent-panel{right:0;left:0;bottom:80px;width:100%;border-radius:16px 16px 0 0}#mtx-agent-btn{right:16px;bottom:16px}.mgenio-bubble{right:90px;max-width:180px}}'
    ].join('\n    ');
    document.head.appendChild(s);
  })();

  /* ââ Config âââââââââââââââââââââââââââââââââââââââââââââââ */
  const AGENT_NAME   = 'MetaGenio';
  const AGENT_ROLE   = 'Agente de Seguimiento';
  const SESSION_KEY  = 'mtx_agent_session_' + Date.now().toString(36);
  const HISTORY_LIMIT = 30; // mensajes mÃ¡x en contexto
  const HISTORY_DISPLAY = 20; // mensajes a mostrar en UI al restaurar

  let db, currentUser, sessionId, messages = [], isOpen = false, isTyping = false;
  let historyLoaded = false;
  let introSent = false;
  let knowledgeBase   = [];
  let websiteSources  = [];
  let sharedDocs      = [];
  let approvedDocs    = [];
  const MODE_STORAGE_KEY = 'mtx_agent_mode';
  let currentMode     = (sessionStorage.getItem(MODE_STORAGE_KEY) || 'metagenio'); // persiste entre navegaciones
  let pipelineState   = null; // datos para MetaFollow

  const MODE_CONFIG = {
    metagenio: {
      label: 'MetaGenio',
      role:  'Asistente General',
      color: '#1a6fff',
      welcome: 'ð Â¡Hola! Soy MetaGenio, tu asistente de portal. Â¿En quÃ© puedo ayudarte?',
      quickActions: [
        { icon:'ð', msg:'Â¿CÃ³mo subo un documento en Docs MTX? ExplÃ­came paso a paso.',        label:'Â¿CÃ³mo subo un documento?' },
        { icon:'ð¯', msg:'Â¿CÃ³mo registro un nuevo lead? ExplÃ­came todos los campos y pasos.',  label:'Â¿CÃ³mo agrego un lead?' },
        { icon:'ð', msg:'Â¿CÃ³mo genero un documento con IA? Dame el proceso completo.',        label:'Â¿CÃ³mo genero documentos?' },
        { icon:'ð¢', msg:'Â¿QuÃ© hace MetaTronix y cuÃ¡les son sus subsidiarias y productos?',    label:'Â¿QuÃ© hace MetaTronix?' },
      ]
    },
    metafollow: {
      label: 'MetaFollow',
      role:  'Agente de Seguimiento',
      color: '#00c853',
      welcome: 'ð¬ Soy MetaFollow. Te ayudo con seguimientos de leads, coordinaciÃ³n con el Orquestador de Ventas y Marketing, y actualizaciones de pipeline.',
      quickActions: [
        { icon:'ð', msg:'Dame el estado actual del pipeline de ventas: etapas, leads urgentes y valor total.',  label:'Estado del pipeline' },
        { icon:'ð¬', msg:'Â¿QuÃ© leads necesitan seguimiento hoy o esta semana? Lista los mÃ¡s urgentes.',          label:'Leads urgentes hoy' },
        { icon:'ð¯', msg:'Â¿QuÃ© ha hecho el Orquestador de Ventas recientemente? Dame un resumen de acciones.', label:'Reporte Orquestador Ventas' },
        { icon:'ð£', msg:'Â¿QuÃ© ha hecho el Orquestador de Marketing recientemente? Dame un resumen.',          label:'Reporte Orquestador Mktg' },
      ]
    },
    dalipx: {
      label: 'Dalipx',
      role:  'Especialista MetaTronix',
      color: '#ff6d00',
      welcome: 'ð¦ Soy Dalipx. Hablo exclusivamente sobre MetaTronix: productos, servicios, procesos internos y cultura de empresa. Â¿QuÃ© quieres saber?',
      quickActions: [
        { icon:'ð¢', msg:'Â¿CuÃ¡les son todos los productos y servicios de MetaTronix e IBANOR SA de CV?',          label:'Productos y servicios' },
        { icon:'ð', msg:'Â¿CuÃ¡les son las subsidiarias de MetaTronix y a quÃ© se dedica cada una?',               label:'Subsidiarias' },
        { icon:'ð', msg:'Â¿CuÃ¡les son los procesos internos principales de MetaTronix para ventas?',             label:'Procesos internos' },
        { icon:'ð¤', msg:'Â¿CuÃ¡l es la propuesta de valor de MetaTronix frente a la competencia?',               label:'Propuesta de valor' },
      ]
    }
  };

    /* ââ MetaGenio SVG âââââââââââââââââââââââââââââââââââââââââââ */
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

  /* ââ Set MetaGenio talking state âââââââââââââââââââââââââââââ */
  function setMetaGenioTalking (active) {
    const avatar = document.getElementById('mgenio-header-avatar');
    if (!avatar) return;
    if (active) avatar.classList.add('mgenio-talking');
    else avatar.classList.remove('mgenio-talking');
  }

  /* ââ Init âââââââââââââââââââââââââââââââââââââââââââââââââ */
  async function init () {
    db        = typeof getDB === 'function' ? getDB() : null;
    sessionId = SESSION_KEY;

    // Retry hasta 4 veces con 600ms de espera â auth puede tardar mÃ¡s de 800ms
    if (typeof getCurrentUser === 'function') {
      for (let attempt = 0; attempt < 4; attempt++) {
        currentUser = await getCurrentUser();
        if (currentUser) break;
        await new Promise(r => setTimeout(r, 600));
      }
    }

    if (!currentUser) return;

    await loadKnowledge();
    buildUI();
    bindEvents();
    await loadRecentHistory();   // carga + renderiza historial en UI
    showSpeechBubble();          // burbuja flotante de saludo
  }

  /* ââ Speech bubble flotante âââââââââââââââââââââââââââââââ */
  function showSpeechBubble () {
    const name = (currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador')
      .split(' ')[0];
    const isReturning = messages.length > 0;
    const text = isReturning
      ? `Â¡Hola de nuevo, <strong>${name}</strong>! Tu historial estÃ¡ listo. Â¿En quÃ© te ayudo?`
      : `Â¡Hola, <strong>${name}</strong>! Soy MetaGenio. Puedo ayudarte con el portal, leads, documentos y mÃ¡s.`;

    const bubble = document.createElement('div');
    bubble.id = 'mgenio-bubble';
    bubble.className = 'mgenio-bubble';
    bubble.innerHTML = `
      <button class="mgenio-bubble-close" onclick="document.getElementById('mgenio-bubble')?.remove()">â</button>
      <p>${text}</p>
      <p style="margin-top:4px;font-size:11px;color:#5a6a85">Haz clic en mÃ­ para abrir el chat ð¬</p>`;

    bubble.addEventListener('pointerup', (e) => {
      if (e.target.classList.contains('mgenio-bubble-close')) return;
      bubble.remove();
      togglePanel(true);
    });

    document.body.appendChild(bubble);

    // Auto-dismiss despuÃ©s de 9 s
    setTimeout(() => {
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(8px)';
      setTimeout(() => bubble.remove(), 400);
    }, 9000);
  }

  /* ââ Cargar base de conocimiento ââââââââââââââââââââââââââ */
  async function loadKnowledge () {
    if (!db) return;
    try {
      // 1. Sitios web scrapeados de MetaTronix y subsidiarias
      const { data: sites } = await db
        .from('knowledge_sources')
        .select('title, source_url, content, source_type')
        .order('created_at', { ascending: true });
      if (sites) websiteSources = sites;

      // 2. Documentos externos subidos por colaboradores (solo los que tienen texto extraÃ­do)
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

  /* ââ System prompt dinÃ¡mico âââââââââââââââââââââââââââââââ */
  /* ââ MetaFollow: carga estado pipeline âââââââââââââââââââ */
  async function loadPipelineState () {
    if (!db || !currentUser) return;
    try {
      let _leadsQ = db.from('leads').select('id,empresa,contacto,etapa,valor_estimado,fecha_seguimiento,notas').order('fecha_seguimiento', { ascending: true }).limit(30);
      if (window.applyCompanyFilter) _leadsQ = window.applyCompanyFilter(_leadsQ);
      const [{ data: leads }, { data: convs }] = await Promise.all([
        _leadsQ,
        db.from('agent_conversations').select('agent_mode,messages,created_at').order('created_at', { ascending: false }).limit(10),
      ]);
      pipelineState = { leads: leads || [], recentConvs: convs || [] };
    } catch (_) { pipelineState = null; }
  }

  /* ââ Switch de modo âââââââââââââââââââââââââââââââââââââââ */
  function switchMode (mode) {
    if (!MODE_CONFIG[mode]) return;
    currentMode = mode;
    sessionStorage.setItem(MODE_STORAGE_KEY, mode); // persistir modo entre pÃ¡ginas
    messages = [];
    introSent = false;
    historyLoaded = false;

    // Actualizar tabs UI
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

    // Limpiar mensajes y mostrar bienvenida del nuevo modo
    const msgBox = document.getElementById('agent-messages');
    if (!msgBox) return;
    msgBox.innerHTML = '';
    const cfg = MODE_CONFIG[mode];

    // Welcome card
    const welcome = document.createElement('div');
    welcome.className = 'agent-welcome';
    welcome.innerHTML = `<div class="agent-welcome-title">${cfg.welcome}</div>`;
    msgBox.appendChild(welcome);

    // Quick actions
    const qa = document.createElement('div');
    qa.className = 'agent-quick-actions';
    qa.id = 'agent-quick-actions';
    cfg.quickActions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'quick-action-btn';
      b.dataset.icon = a.icon;
      b.dataset.msg  = a.msg;
      b.textContent  = a.label;
      b.onclick = () => sendMessage(a.msg);
      qa.appendChild(b);
    });
    msgBox.appendChild(qa);

    // Actualizar color acento del panel
    const panel = document.getElementById('mtx-agent-panel');
    if (panel) panel.style.setProperty('--mode-color', cfg.color);

    // Si MetaFollow, cargar pipeline en background
    if (mode === 'metafollow') loadPipelineState();
  }

  function buildSystemPrompt () {
    if (currentMode === 'metafollow') return buildMetaFollowPrompt();
    if (currentMode === 'dalipx') return buildDalipxPrompt();
    const page     = detectPage();
    const userName = currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador';
    const userRole = currentUser?.profile?.role || 'user';
    const isAdmin  = ['admin','super_admin','admin_restringido'].includes(userRole);

    // ââ SecciÃ³n 1: Sitios web de MetaTronix y subsidiarias ââ
    let sitesText = '';
    if (websiteSources.length) {
      sitesText = '\n\nââââââââââââââââââââââââââââââââââââââââ\n';
      sitesText += 'INFORMACIÃN OFICIAL DE METATRONIX Y SUBSIDIARIAS\n';
      sitesText += 'ââââââââââââââââââââââââââââââââââââââââ\n';
      websiteSources.forEach(s => {
        sitesText += `\nâ¸ ${s.title} (${s.source_url})\n${s.content}\n`;
      });
    }

    // ââ SecciÃ³n 2: Documentos externos subidos por colaboradores ââ
    const estudios    = sharedDocs.filter(d => d.category === 'estudios_mercado');
    const otrosDocs   = sharedDocs.filter(d => d.category !== 'estudios_mercado');
    const docsWithText = otrosDocs.filter(d => d.text_content && d.text_content.trim().length > 20);
    const docsMetaOnly = otrosDocs.filter(d => !d.text_content || d.text_content.trim().length <= 20);

    // Estudios de mercado â secciÃ³n dedicada
    let estudiosText = '';
    if (estudios.length) {
      estudiosText = '\n\nââââââââââââââââââââââââââââââââââââââââ\n';
      estudiosText += 'ESTUDIOS DE MERCADO (generados por Inteligencia de Mercados)\n';
      estudiosText += 'ââââââââââââââââââââââââââââââââââââââââ\n';
      estudiosText += 'IMPORTANTE: Estos estudios fueron generados por el equipo con datos reales. Ãsalos como base para responder preguntas sobre mercados, sectores, leads y oportunidades.\n';
      estudios.forEach(d => {
        estudiosText += `\nâ¸ ${d.title}\n`;
        if (d.description) estudiosText += `  Consulta original: ${d.description}\n`;
        if (d.text_content) estudiosText += `${d.text_content.slice(0, 4000)}\n`;
      });
    }

    let sharedDocsText = '';
    if (otrosDocs.length) {
      sharedDocsText = '\n\nââââââââââââââââââââââââââââââââââââââââ\n';
      sharedDocsText += 'DOCUMENTOS EXTERNOS SUBIDOS POR COLABORADORES\n';
      sharedDocsText += 'ââââââââââââââââââââââââââââââââââââââââ\n';
      if (docsWithText.length) {
        sharedDocsText += '\nDocumentos con contenido extraÃ­do:\n';
        docsWithText.forEach(d => {
          sharedDocsText += `\nâ¸ "${d.title}" [${d.category}] â subido por ${d.uploaded_by_name || 'colaborador'}\n`;
          sharedDocsText += `  Archivo: ${d.file_name}\n`;
          if (d.description) sharedDocsText += `  DescripciÃ³n: ${d.description}\n`;
          sharedDocsText += `  Contenido:\n${d.text_content.slice(0, 3000)}\n`;
        });
      }
      if (docsMetaOnly.length) {
        sharedDocsText += '\nDocumentos disponibles (binarios â sin texto extraÃ­do):\n';
        docsMetaOnly.forEach(d => {
          sharedDocsText += `  â¢ "${d.title}" [${d.category}] â ${d.file_name}`;
          if (d.description) sharedDocsText += ` â ${d.description}`;
          sharedDocsText += '\n';
        });
      }
    }

    // ââ SecciÃ³n 3: Documentos generados con IA (aprobados) ââ
    let approvedText = '';
    if (approvedDocs.length) {
      approvedText = '\n\nââââââââââââââââââââââââââââââââââââââââ\n';
      approvedText += 'DOCUMENTOS GENERADOS EN EL PORTAL (APROBADOS)\n';
      approvedText += 'ââââââââââââââââââââââââââââââââââââââââ\n';
      approvedDocs.forEach(d => {
        const snippet = d.content
          ? d.content.replace(/<[^>]*>/g, ' ').trim().slice(0, 400) + 'â¦'
          : 'Sin contenido disponible.';
        approvedText += `\nâ¸ "${d.title}" (${d.doc_type})\n  ${snippet}\n`;
      });
    }

    // ââ SecciÃ³n 4: KB legacy ââ
    let kbText = '';
    if (knowledgeBase.length) {
      kbText = '\n\nââââââââââââââââââââââââââââââââââââââââ\n';
      kbText += 'BASE DE CONOCIMIENTO ADICIONAL\n';
      kbText += 'ââââââââââââââââââââââââââââââââââââââââ\n';
      knowledgeBase.forEach(k => {
        kbText += `\n[${(k.category||'').toUpperCase()}] ${k.title}:\n${k.content}\n`;
      });
    }

    const hasAnyKnowledge = websiteSources.length || sharedDocs.length || approvedDocs.length;

    return `Eres MetaGenio, el Agente Inteligente de MetaTronix. Asistes a los colaboradores de IBANOR SA de CV en el Portal Interno metatronixleads.tech.

IDENTIDAD: Eres un experto en el portal MetaTronix y en todos los productos y subsidiarias de la empresa. Respondes siempre en espaÃ±ol. Tienes una personalidad servicial, directa y con un leve toque de humor de oficina. Ocasionalmente puedes hacer referencias sutiles y cÃ¡lidas a tu historia como asistente de oficina clÃ¡sico.

USUARIO ACTUAL:
- Nombre: ${userName}
- Rol: ${userRole}
- PÃ¡gina activa: ${page.name} â ${page.desc}

ââââââââââââââââââââââââââââââââââââââââ
GUÃA COMPLETA DEL PORTAL â NAVEGACIÃN PASO A PASO
ââââââââââââââââââââââââââââââââââââââââ

Cuando el usuario pregunte cÃ³mo hacer algo en el portal, da instrucciones completas paso a paso, con el nombre exacto de cada botÃ³n, secciÃ³n o campo. Nunca digas "busca el botÃ³n" sin describir exactamente dÃ³nde estÃ¡ y cÃ³mo se ve.

â¸ HOME (/home.html)
  - Primer tab del portal (sidebar izquierdo, botÃ³n "Home")
  - Muestra: KPIs personales en tiempo real (Mis Leads, Pipeline, Tasa de Cierre, Documentos, Leads urgentes)
  - Panel de clientes por urgencia: CRÃTICO (vencido), URGENTE (â¤3 dÃ­as), Normal, Sin fecha
  - Forecast ponderado por etapa de ventas
  - Resumen de documentos del usuario, alertas recientes y accesos rÃ¡pidos

â¸ DOCUMENTOS / DASHBOARD (/dashboard.html)
  - BotÃ³n "Adm. Docs para Venta" en la barra lateral izquierda
  - Muestra todos los documentos generados por el usuario con su estado: Borrador, En RevisiÃ³n, Aprobado
  - Acciones por documento: Ver, Descargar (HTML), Editar, Enviar a revisiÃ³n
  - Para ENVIAR A REVISIÃN: abre el documento â botÃ³n "Enviar a RevisiÃ³n" â escribe un mensaje opcional â confirmar
  - Para DESCARGAR: botÃ³n "Descargar" â se descarga como archivo HTML

â¸ GENERAR DOCUMENTOS (/generate.html)
  - BotÃ³n "Generar" en la barra lateral
  - Panel izquierdo: llena el formulario â Tipo de documento, Cliente/Empresa, Prompt/instrucciones
  - Tipos disponibles: Propuesta Comercial, Contrato, CotizaciÃ³n, Carta Formal, Documento TÃ©cnico, Informe Ejecutivo, Acuerdo de Confidencialidad, Manual de Procedimientos
  - Panel derecho: previsualizaciÃ³n del documento generado en tiempo real
  - Pasos: 1) Selecciona el tipo â 2) Escribe el prompt/instrucciones â 3) Clic en "Generar" â 4) Espera la respuesta â 5) Edita si necesitas â 6) Guarda o envÃ­a a revisiÃ³n

â¸ LEADS (/leads.html)
  - BotÃ³n "Leads" en la barra lateral
  - Vista Lista o Vista Kanban (botones arriba a la derecha)
  - Para AGREGAR UN LEAD: botÃ³n "+ Nuevo Lead" â llena empresa (obligatorio), contacto, cargo, email, telÃ©fono, estado, fuente, valor estimado, fecha de seguimiento, nivel de confianza, notas â "Guardar Lead"
  - Estados: Nuevo â Contactado â En NegociaciÃ³n â Propuesta Enviada â Cerrado Ganado / Cerrado Perdido
  - Para EDITAR: clic en cualquier fila de la tabla o tarjeta Kanban
  - Para ELIMINAR: editar lead â botÃ³n rojo "Eliminar" en la parte inferior del formulario
  - Plan de seguimiento: al guardar un lead nuevo, aparece un modal para definir fecha, canal, objetivo y frecuencia de seguimiento
  - Filtros: por estado, fuente, o bÃºsqueda de texto

â¸ DOCS MTX (/mtx-docs.html)
  - BotÃ³n "Docs MTX" en la barra lateral â biblioteca compartida de documentos
  - Todos los usuarios pueden SUBIR archivos
  - Para SUBIR: botÃ³n "+ Subir Documento" â completa tÃ­tulo, descripciÃ³n, categorÃ­a â arrastra el archivo o usa el selector â selecciona visibilidad (Todos / Solo Admin) â "Subir Documento"
  - Formatos soportados: PDF, Word, Excel, imÃ¡genes, texto, CSV, JSON y mÃ¡s
  - MetaGenio aprende automÃ¡ticamente del contenido de los documentos subidos
  - Para DESCARGAR: botÃ³n "Descargar" en la tarjeta del documento
  - Para ELIMINAR: solo el que lo subiÃ³ o un admin puede eliminarlo

â¸ OPORTUNIDADES (/oportunidades.html)
  - BotÃ³n "Oportunidades" en la barra lateral â inteligencia de ventas (requiere autorizaciÃ³n del SuperAdmin)
  - Segmentos disponibles: BÃºsqueda de Leads, InvestigaciÃ³n de Mercado, Intel de Empresas, AnÃ¡lisis de Sector, Argumentos de Venta, Tendencias
  - Si no tienes acceso: botÃ³n "Solicitar Acceso" â el SuperAdmin recibe la notificaciÃ³n y puede autorizarte
  - Para usar: selecciona un segmento â escribe tu consulta â los resultados aparecen en tiempo real con fuentes

â¸ ADMIN (/admin.html) â Solo para admins
  - BotÃ³n "Admin" en la barra lateral (solo visible para admin, admin_restringido, super_admin)
  - Tabs: Alertas, Usuarios, Documentos, IA APIs
  - GestiÃ³n de usuarios: cambiar roles, habilitar/deshabilitar Claude, configurar lÃ­mites mensuales
  - Autorizar acceso a Oportunidades por usuario

â¸ SIDEBAR Y NAVEGACIÃN
  - La barra de navegaciÃ³n estÃ¡ en el lado IZQUIERDO de la pantalla (columna vertical)
  - Los botones son: Home, Adm. Docs para Venta, Leads, Generar, Docs MTX, Oportunidades, Admin
  - En la parte inferior del sidebar: avatar del usuario, rol y botÃ³n "â© Salir" para cerrar sesiÃ³n
  - El Ã­cono de campana (ð) abre las alertas del sistema

â¸ PIPELINE CRM (/leads.html)
  - BotÃ³n "Pipeline" o "Leads" en la barra lateral
  - Gestiona todos los clientes y prospectos de la empresa
  - Vistas: Lista (tabla) y Kanban (tarjetas arrastrables por etapa)
  - Etapas del pipeline: Nuevo â Contactado â En NegociaciÃ³n â Propuesta Enviada â Cerrado Ganado / Cerrado Perdido
  - Para AGREGAR UN LEAD: botÃ³n "+ Nuevo Lead" â llena empresa (obligatorio), contacto, cargo, email, telÃ©fono, estado, fuente, valor estimado, fecha de seguimiento, confianza y notas â "Guardar Lead"
  - Para EDITAR: clic en cualquier fila o tarjeta Kanban â se abre el formulario â modifica â "Actualizar"
  - Para ELIMINAR: abrir el lead â botÃ³n rojo "Eliminar" en la parte inferior
  - Para ADJUNTAR ARCHIVOS a un lead: abre el lead â busca el Ã­cono ð "Archivos adjuntos" â arrastra el archivo o selecciÃ³nalo â espera la palomita verde
  - Filtros disponibles: por estado, fuente, empresa, bÃºsqueda de texto
  - Kanban: arrastra tarjetas entre columnas para cambiar de etapa

â¸ VENTAS IA (/ventas.html)
  - BotÃ³n "Ventas IA" en la barra lateral
  - 10 agentes de inteligencia artificial especializados en diferentes etapas del proceso de ventas:
    Â· Prospector â busca nuevos clientes potenciales; escrÃ­bele el sector o tipo de empresa que buscas
    Â· Calificador â analiza si un prospecto vale la pena; dale la info del prospecto y te dice si conviene
    Â· Descubridor â genera preguntas para entender las necesidades del cliente
    Â· Presentador â crea argumentos de venta y presentaciones; dile el producto y el perfil del cliente
    Â· Negociador â estrategias para manejar objeciones; cuÃ©ntale la objeciÃ³n y te da respuestas
    Â· Cerrador â seÃ±ales de cierre y tÃ©cnicas para cerrar el trato; descrÃ­bele la situaciÃ³n actual
    Â· Propuesta IA â redacta propuestas y cotizaciones profesionales; dale los detalles del proyecto
    Â· Seguimiento IA â te dice cuÃ¡ndo y cÃ³mo dar seguimiento; dale el historial del prospecto
    Â· WBR Pipeline â revisa el estado del pipeline semanalmente y da recomendaciones
    Â· INTEL â inteligencia de mercado y anÃ¡lisis de competencia; pregÃºntale sobre tu sector
  - Para usar cualquier agente: selecciona el agente â escribe tu consulta o situaciÃ³n â clic "Enviar" â espera la respuesta
  - Cuanto mÃ¡s contexto des (nombre empresa, producto, situaciÃ³n especÃ­fica), mejor serÃ¡ la respuesta

â¸ MARKETING IA (/marketing.html)
  - BotÃ³n "Marketing IA" en la barra lateral
  - 14 agentes creativos y de anÃ¡lisis de marketing:
    Â· Observador â monitorea tendencias y novedades del mercado
    Â· Narrador â redacta textos para publicaciones, emails y anuncios; dile el tema y el tono
    Â· Director Creativo â define el estilo visual de las campaÃ±as
    Â· Motor â ayuda a lanzar campaÃ±as rÃ¡pidamente
    Â· Conversor â mejora pÃ¡ginas y mensajes para convertir mÃ¡s visitantes en clientes
    Â· Aprendizaje â analiza quÃ© campaÃ±as han funcionado y da recomendaciones
    Â· Video IA â crea guiones y storyboards para videos
    Â· Imagen IA â sugiere conceptos visuales para diseÃ±os
    Â· Simulador Social â muestra cÃ³mo quedarÃ­a una publicaciÃ³n en redes sociales
    Â· MetaGenio Marketing â anÃ¡lisis holÃ­stico de la estrategia de marketing
  - Para usar: selecciona el agente â escribe tu consulta â espera la respuesta

â¸ FINANZAS (/finanzas.html)
  - BotÃ³n "Finanzas" en la barra lateral (requiere rol admin o superior)
  - Dashboard financiero en tiempo real: flujo de caja por mes, ingresos vs egresos, KPIs clave
  - Selector de empresa en la parte superior para ver finanzas por empresa del grupo
  - Copiloto Financiero IA: cuadro de texto en la parte inferior â escribe preguntas como "Â¿cuÃ¡l fue mi mes mÃ¡s rentable?" o "Â¿dÃ³nde estoy gastando mÃ¡s?"
  - Los datos financieros se actualizan conforme el equipo administrativo los registra

â¸ COMPRAS (/compras.html)
  - BotÃ³n "Compras" en la barra lateral
  - GestiÃ³n de Ã³rdenes de compra (Purchase Orders / POs) y proveedores
  - Para CREAR UNA REQUISICIÃN: botÃ³n "+ Nueva RequisiciÃ³n" â llena quÃ© necesitas, cantidad, cuÃ¡ndo y justificaciÃ³n â "Enviar"
  - Estados de una PO: Borrador â Pendiente de AprobaciÃ³n â Aprobada â En Proceso â Completada / Cancelada
  - Para ADJUNTAR ARCHIVOS a una PO (facturas, cotizaciones, contratos):
    Â· Abre la orden de compra
    Â· Haz clic en el Ã­cono ð "Archivos adjuntos" (aparece en la esquina superior derecha de la ficha)
    Â· Arrastra el archivo a la zona de carga o haz clic en "Seleccionar archivo"
    Â· El archivo se sube al instante. Cuando ves la palomita â, ya estÃ¡ guardado y seguro
    Â· Puedes subir PDF, Word, Excel, imÃ¡genes, ZIP. MÃ¡ximo 50 MB por archivo
  - Para VER ARCHIVOS ADJUNTOS: el botÃ³n del Ã­cono clip muestra el nÃºmero de archivos (badge)
  - Para DESCARGAR un archivo: haz clic en el archivo â botÃ³n "Descargar". El enlace es vÃ¡lido 60 minutos

â¸ COBRANZA (/cobranza.html)
  - BotÃ³n "Cobranza" en la barra lateral
  - Cola inteligente de cuentas por cobrar, ordenada por urgencia (mÃ¡s vencida + mayor monto = primero)
  - PriorizaciÃ³n automÃ¡tica: CRÃTICO (vencido), URGENTE (â¤7 dÃ­as), NORMAL, SIN VENCIMIENTO
  - Para usar: selecciona un registro â el sistema muestra el historial del cliente y sugiere un mensaje de cobro
  - Puedes usar el mensaje sugerido o editarlo antes de enviarlo
  - Registra cada contacto (llamada, email, WhatsApp) para llevar el historial completo
  - TambiÃ©n puedes adjuntar archivos a cada cuenta por cobrar (contratos, acuses de recibo)

â¸ DOCUMENTOS (/documentos.html)
  - BotÃ³n "Documentos" en la barra lateral
  - Repositorio central de archivos de la empresa â todos los documentos en un solo lugar
  - Para SUBIR: botÃ³n "Subir Archivo" o arrastra directamente a la zona marcada â elige categorÃ­a â espera palomita â
  - CategorÃ­as disponibles: Factura Emitida, Factura de Proveedor, RequisiciÃ³n, PO, Lead, General
  - Para BUSCAR: usa la barra de bÃºsqueda en la parte superior â resultados en tiempo real
  - Para DESCARGAR: clic en el archivo â botÃ³n "Descargar" â el enlace es vÃ¡lido 60 minutos
  - Formatos soportados: PDF, Word (DOCX), Excel (XLSX), PowerPoint, imÃ¡genes (JPG/PNG), ZIP, RAR, XML, CSV
  - Diferencia clave: Documentos es el repositorio CENTRAL. AdemÃ¡s, cada registro individual (lead, PO, factura) tiene sus propios archivos adjuntos accesibles desde ese registro

â¸ SISTEMA DE ARCHIVOS ADJUNTOS (funciona en varios mÃ³dulos)
  - El Ã­cono ð aparece en: Leads (Pipeline CRM), Ãrdenes de Compra (Compras) y registros de Cobranza
  - CÃ³mo abrir el cajÃ³n de adjuntos: haz clic en el Ã­cono ð del registro â se abre el panel lateral derecho
  - Para subir: arrastra el archivo al panel o haz clic en "Seleccionar archivo"
  - Para descargar: clic en el nombre del archivo â botÃ³n "Descargar"
  - Para cerrar: clic en la X del panel o en cualquier lugar fuera del panel
  - El nÃºmero de archivos aparece como un badge (nÃºmero pequeÃ±o) sobre el Ã­cono ð
  - MÃ¡ximo 50 MB por archivo. Tipos: PDF, Word, Excel, PowerPoint, imÃ¡genes, ZIP, XML, CSV

â¸ CEO NERVE CENTER (/ceo.html)
  - BotÃ³n "CEO" en la barra lateral (requiere rol admin o superior)
  - 4 directores IA que analizan el negocio desde diferentes Ã¡ngulos:
    Â· Director de Ventas â analiza pipeline, oportunidades y rendimiento comercial
    Â· Director de Marketing â revisa campaÃ±as, alcance y posicionamiento de marca
    Â· Director de Operaciones â evalÃºa eficiencia, procesos y proveedores
    Â· Director de Finanzas â analiza flujos de caja, mÃ¡rgenes y salud financiera
  - TambiÃ©n incluye: Pulso Organizacional en tiempo real, Reportes Ejecutivos automÃ¡ticos, KPIs por Ã¡rea
  - Para usar: selecciona el Director â escribe tu pregunta sobre el negocio â obtÃ©n anÃ¡lisis profesional
  - Ejemplos de preguntas: "Â¿CuÃ¡l es el estado actual de nuestro pipeline?", "Â¿DÃ³nde debemos enfocar marketing este trimestre?"

â¸ CONSEJO EJECUTIVO IA (/consejo.html)
  - BotÃ³n "Consejo" en la barra lateral (requiere rol admin o superior)
  - 5 mesas de decisiÃ³n estratÃ©gica con agentes IA especializados:
    Â· Mesa de InnovaciÃ³n â ideas para crecer y diferenciarse
    Â· Mesa Legal y Compliance â aspectos legales y de cumplimiento normativo
    Â· Mesa de Estrategia â planeaciÃ³n de largo plazo y decisiones crÃ­ticas
    Â· Mesa de Recursos Humanos â gestiÃ³n de personas, talento y cultura
    Â· Mesa Financiera â decisiones sobre inversiÃ³n, capital y presupuesto
  - Para usar: selecciona la mesa â escribe tu pregunta estratÃ©gica â la IA da anÃ¡lisis completo con perspectivas mÃºltiples
  - Ideal para decisiones importantes: expansiÃ³n, contrataciones clave, cambios de estrategia, inversiones

â¸ EMPRESAS (/empresas.html)
  - BotÃ³n "Empresas" en la barra lateral (requiere rol admin o super_admin)
  - Muestra todas las empresas del grupo empresarial de IBANOR SA de CV
  - Puedes cambiar entre empresas usando el selector de empresa en la barra superior
  - Al cambiar de empresa, toda la informaciÃ³n del portal (pipeline, finanzas, compras, etc.) se actualiza para mostrar los datos de esa empresa
  - Para cambiar de empresa: barra superior â selector de empresa â clic en la empresa deseada

â¸ OPS PANEL (/ops.html)
  - Panel operativo para usuarios con rol Viewer y Readonly
  - Los usuarios con rol admin/super_admin son redirigidos automÃ¡ticamente a Home (esto es correcto por diseÃ±o)
  - Muestra mÃ©tricas operativas bÃ¡sicas de solo lectura

â¸ METAGENIO (este asistente)
  - Aparece como un chip animado con red neuronal en la esquina inferior derecha de CUALQUIER pÃ¡gina
  - Clic para abrir/cerrar el chat
  - Tres modos disponibles (selector en la parte superior del chat):
    Â· MetaGenio â conoce todo el portal; pregÃºntale cualquier cosa sobre cÃ³mo funciona
    Â· MetaFollow â especialista en seguimiento; te dice quÃ© clientes contactar hoy y con quÃ© mensaje
    Â· Dalipx â experto en MetaTronix; responde preguntas sobre productos y propuesta de valor
  - BotÃ³n de recarga (âº) en el header del chat para iniciar nueva conversaciÃ³n
  - El historial se guarda automÃ¡ticamente por usuario y por sesiÃ³n

ââââââââââââââââââââââââââââââââââââââââ
CAPACIDADES DE METAGENIO
ââââââââââââââââââââââââââââââââââââââââ
- Explicas cÃ³mo usar cualquier funciÃ³n del portal PASO A PASO con instrucciones exactas
- Respondes preguntas sobre MetaTronix basÃ¡ndote en los documentos y sitios web cargados
- Ayudas con leads: redacciÃ³n de emails, estrategia de seguimiento, anÃ¡lisis de probabilidad de cierre
- Ayudas con documentos: quÃ© tipo usar, cÃ³mo estructurar el prompt, quÃ© incluir
- Orientas al usuario hacia la secciÃ³n correcta cuando no saben dÃ³nde ir

INSTRUCCIÃN ESPECIAL â NAVEGACIÃN:
Si el usuario quiere ir a una secciÃ³n especÃ­fica, incluye al final de tu respuesta una lÃ­nea con este formato exacto (SIN texto adicional en esa lÃ­nea):
[NAV:/ruta.html]
Ejemplo: si el usuario dice "llÃ©vame a leads", incluye al final: [NAV:/leads.html]
Solo incluye [NAV:...] si el usuario pide explÃ­citamente navegar o ir a una secciÃ³n.

SOBRE METATRONIX Y SUBSIDIARIAS:
- Portal interno de IBANOR SA de CV
- Contacto admin: acanales@ibanormexico.com
${estudiosText}${sitesText}${sharedDocsText}${approvedText}${kbText}

ââââââââââââââââââââââââââââââââââââââââ
REGLAS DE COMPORTAMIENTO
ââââââââââââââââââââââââââââââââââââââââ
1. FUENTE EXCLUSIVA para info de la empresa: usa solo las fuentes documentadas arriba. Para el portal, usa la guÃ­a de esta instrucciÃ³n.
2. Si preguntan sobre MetaTronix y no tienes la info: "No tengo eso en mis fuentes. Puedes subir el documento en Docs MTX."
3. ${isAdmin ? 'Como admin, puedes ver informaciÃ³n completa de todos los usuarios.' : 'No menciones datos de otros usuarios.'}
4. Respuestas claras. Usa listas numeradas para instrucciones paso a paso. Usa listas con viÃ±etas para opciones.
5. Nunca compartas datos personales de otros colaboradores.
6. Si el usuario parece perdido, pregÃºntale quÃ© quiere lograr y guÃ­alo proactivamente.
${!hasAnyKnowledge ? '\nNOTA: Sin documentos ni sitios web cargados aÃºn. Responde sobre el portal usando la guÃ­a anterior.' : ''}`;
  }

  /* ââ MetaFollow system prompt ââââââââââââââââââââââââââââ */
  function buildMetaFollowPrompt () {
    const userName = currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador';
    let pipelineText = '';
    if (pipelineState?.leads?.length) {
      pipelineText = '\n\nââââââââ ESTADO ACTUAL DEL PIPELINE ââââââââ\n';
      const now = new Date();
      pipelineState.leads.forEach(l => {
        const fecha = l.fecha_seguimiento ? new Date(l.fecha_seguimiento) : null;
        const diasRestantes = fecha ? Math.ceil((fecha - now) / 86400000) : null;
        const urgencia = diasRestantes !== null ? (diasRestantes < 0 ? 'ð´ VENCIDO' : diasRestantes <= 3 ? 'ð¡ URGENTE' : 'ð¢') : 'âª';
        pipelineText += `${urgencia} ${l.empresa} | ${l.etapa} | $${(l.valor_estimado||0).toLocaleString()} | ${fecha ? fecha.toLocaleDateString('es-MX') : 'Sin fecha'}\n`;
      });
      const total = pipelineState.leads.reduce((s, l) => s + (l.valor_estimado || 0), 0);
      pipelineText += `\nTOTAL PIPELINE: $${total.toLocaleString()} MXN | ${pipelineState.leads.length} leads activos\n`;
    }
    return `Eres MetaFollow, el Agente de Seguimiento y CoordinaciÃ³n de MetaTronix.

IDENTIDAD: Especialista en seguimiento de prospectos, coordinaciÃ³n entre equipos y actualizaciÃ³n del pipeline. Trabajas de la mano con el Orquestador de Ventas (en ventas.html) y el Orquestador de Marketing (en marketing.html). Eres directo, orientado a acciÃ³n, con respuestas concretas y ejecutables.

USUARIO: ${userName}

TUS FUNCIONES PRINCIPALES:
1. Reportar el estado del pipeline de ventas en tiempo real
2. Identificar leads que necesitan seguimiento urgente
3. Coordinar con el Orquestador de Ventas: envÃ­a resÃºmenes de pipeline, sugiere acciones de cierre
4. Coordinar con el Orquestador de Marketing: reporta quÃ© leads llegaron por cada canal, quÃ© campaÃ±as estÃ¡n activas
5. Generar secuencias de seguimiento (email, WhatsApp, llamada) personalizadas
6. Resumir quÃ© han hecho los agentes de ventas y marketing recientemente
${pipelineText}
ORQUESTADORES DISPONIBLES:
- Orquestador de Ventas â en /ventas.html â dirige 10 agentes: Prospector, Calificador, Descubridor, Presentador, Negociador, Cerrador, Propuesta IA, Seguimiento IA, WBR Pipeline AI
- Orquestador de Marketing â en /marketing.html â dirige 14 agentes: Observador, Narrador, Director, Motor, Conversor, Aprendizaje, Video IA, Imagen IA, Simulador Social

REGLAS:
1. Siempre responde en espaÃ±ol, con acciones especÃ­ficas y ejecutables
2. Para actualizaciones del Orquestador: sugiere quÃ© comunicar y cÃ³mo, y proporciona el mensaje listo para copiar/pegar
3. Prioriza siempre por urgencia (leads vencidos > leads urgentes > leads normales)
4. Cuando no tengas datos en tiempo real, indÃ­calo claramente y sugiere dÃ³nde verificar`;
  }

  /* ââ Dalipx system prompt âââââââââââââââââââââââââââââ */
  function buildDalipxPrompt () {
    const userName = currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador';
    let mtxKnowledge = '';
    if (websiteSources.length) {
      websiteSources.forEach(s => { mtxKnowledge += `\nâ¸ ${s.title}:\n${s.content}\n`; });
    }
    if (sharedDocs.length) {
      sharedDocs.filter(d => d.text_content).forEach(d => { mtxKnowledge += `\nâ¸ ${d.title}:\n${d.text_content?.slice(0,2000)}\n`; });
    }
    return `Eres Dalipx, el Especialista de Marca MetaTronix.

IDENTIDAD: Agente de conocimiento profundo sobre MetaTronix e IBANOR SA de CV. Tu Ãºnico propÃ³sito es responder preguntas sobre MetaTronix: productos, servicios, subsidiarias, procesos internos, cultura, propuesta de valor y estrategia comercial.

USUARIO: ${userName}

REGLA ABSOLUTA: Solo hablas de MetaTronix, IBANOR SA de CV, y sus subsidiarias y productos.
Si alguien pregunta sobre cualquier otro tema (polÃ­tica, deportes, tecnologÃ­a general, competidores, etc.), respondes amablemente:
"Soy Dalipx, especialista exclusivo de MetaTronix. Solo puedo ayudarte con preguntas sobre MetaTronix, IBANOR SA de CV, sus productos y servicios. Â¿En quÃ© aspecto de MetaTronix puedo ayudarte?"

ÃREAS DE CONOCIMIENTO METATRONIX:
- Productos y servicios de MetaTronix e IBANOR SA de CV
- Subsidiarias y su propÃ³sito
- Propuesta de valor y diferenciadores competitivos
- Procesos internos de ventas, marketing y operaciones
- Cultura organizacional y valores de la empresa
- Portal interno metatronixleads.tech y sus mÃ³dulos
- Agentes MetaGenio y MetaFollow (colaboran contigo en el mismo panel)
- PolÃ­ticas, procedimientos y documentos oficiales
${mtxKnowledge ? '\nââââ CONOCIMIENTO OFICIAL METATRONIX ââââ\n' + mtxKnowledge : ''}
TONO: Experto, confiado, representante orgulloso de la marca MetaTronix. Nunca especules sobre MetaTronix si no tienes la informaciÃ³n â di claramente que no tienes ese dato y sugiere consultar con el equipo o subir el documento en Docs MTX.`;
  }

  /* ââ Detectar pÃ¡gina actual âââââââââââââââââââââââââââââââ */
  function detectPage () {
    const path = window.location.pathname;
    const pages = {
      '/home.html':      { name: 'Home',       desc: 'Panel de inicio con KPIs personales, leads urgentes y resumen del portal.' },
      '/dashboard.html': { name: 'Adm. Docs para Venta', desc: 'Vista general con documentos generados y su estado de revisiÃ³n.' },
      '/generate.html':  { name: 'Generar',    desc: 'MÃ³dulo para crear documentos con IA: propuestas, contratos, cotizaciones.' },
      '/leads.html':     { name: 'Leads',      desc: 'GestiÃ³n de prospectos y clientes de ventas con Kanban y KPIs personales.' },
      '/admin.html':     { name: 'Admin',      desc: 'Panel de administraciÃ³n: usuarios, alertas, configuraciÃ³n del portal.' },
      '/mtx-docs.html':  { name: 'Docs MTX',   desc: 'Biblioteca de documentos compartidos. Todos los usuarios pueden subir archivos.' },
      '/oportunidades.html': { name: 'Oportunidades', desc: 'Inteligencia de ventas: leads, mercado, anÃ¡lisis de sector.' },
      '/':               { name: 'Login',      desc: 'PÃ¡gina de acceso al portal.' },
      '/index.html':     { name: 'Login',      desc: 'PÃ¡gina de acceso al portal.' },
    };
    return pages[path] || { name: path, desc: 'PÃ¡gina del portal.' };
  }

  /* ââ Cargar historial reciente ââââââââââââââââââââââââââââ */
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
    if (diffDays < 7)  return `hace ${diffDays} dÃ­as`;
    return d.toLocaleDateString('es-MX', { day:'numeric', month:'short' });
  }

  function renderHistoryInUI (histMsgs, lastDate) {
    if (!histMsgs.length) return;
    const msgBox = document.getElementById('agent-messages');
    if (!msgBox) return;

    // Quitar welcome card si existe
    msgBox.querySelector('.agent-welcome')?.remove();
    msgBox.querySelector('.agent-quick-actions')?.remove();

    // Separador "ConversaciÃ³n anterior"
    const sep = document.createElement('div');
    sep.className = 'history-sep';
    sep.innerHTML = `<span>Historial Â· ${formatHistoryDate(lastDate)}</span>`;
    msgBox.appendChild(sep);

    histMsgs.forEach(m => {
      if (m.role === 'user' || m.role === 'assistant') {
        appendMessage(m.role === 'assistant' ? 'agent' : 'user', m.content, true);
      }
    });

    // Separador "SesiÃ³n actual"
    const sep2 = document.createElement('div');
    sep2.className = 'history-sep history-sep-new';
    sep2.innerHTML = `<span>SesiÃ³n actual</span>`;
    msgBox.appendChild(sep2);
  }

  /* ââ Guardar conversaciÃ³n âââââââââââââââââââââââââââââââââ */
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

  /* ââ Call Claude via proxy ââââââââââââââââââââââââââââââââ */
  async function callClaude (userMessage) {
    const proxyUrl = window.MTX_CONFIG?.CLAUDE_PROXY_URL;
    if (!proxyUrl) return 'Error: proxy no configurado.';

    messages.push({ role: 'user', content: userMessage });

    // Mantener historial limitado (excluye system)
    const contextMsgs = messages.slice(-HISTORY_LIMIT);

    try {
      // Inyectar JWT de Supabase para autenticaciÃ³n con el Worker v2
      let _authH = {};
      try {
        if (db) {
          const { data: _sd } = await db.auth.getSession();
          const _tok = _sd?.session?.access_token;
          if (_tok) _authH = { 'Authorization': `Bearer ${_tok}` };
        }
      } catch (_) {}

      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._authH },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system:     buildSystemPrompt(),
          messages:   contextMsgs,
          stream:     true
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Error ' + res.status);
      }

      // Leer stream SSE que devuelve el Worker
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer   = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Ãºltimo fragmento incompleto
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const chunk = line.slice(6).trim();
          if (chunk === '[DONE]') break;
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.delta?.text) fullText += parsed.delta.text;
          } catch {}
        }
      }

      const reply = fullText.trim() || 'Sin respuesta.';
      messages.push({ role: 'assistant', content: reply });
      await saveConversation();
      return reply;
    } catch (e) {
      const isAuthErr = e.message && (e.message.includes('401') || e.message.includes('authentication') || e.message.includes('api-key'));
      const reply = isAuthErr
        ? 'MetaGenio estÃ¡ pendiente de activaciÃ³n. El administrador debe configurar la API key. Contacta a acanales@ibanormexico.com.'
        : 'OcurriÃ³ un error al conectar con MetaGenio. Intenta de nuevo en un momento.';
      messages.push({ role: 'assistant', content: reply });
      return reply;
    }
  }

  /* ââ Render markdown bÃ¡sico âââââââââââââââââââââââââââââââ */
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

  /* ââ Build UI âââââââââââââââââââââââââââââââââââââââââââââ */
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
          <div class="agent-name">${AGENT_NAME} Â· ${AGENT_ROLE}</div>
          <div class="agent-status">
            <span class="agent-status-dot"></span>
            En lÃ­nea Â· MetaTronix Intelligence
          </div>
        </div>
        <div class="agent-header-actions">
          <button class="agent-header-btn" id="agent-clear-btn" title="Nueva conversaciÃ³n">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.51"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Mode tabs -->
      <div class="agent-mode-tabs">
        <button class="mode-tab active" data-mode="metagenio">MetaGenio</button>
        <button class="mode-tab" data-mode="metafollow">MetaFollow</button>
        <button class="mode-tab" data-mode="dalipx">Dalipx</button>
      </div>

      <!-- Messages -->
      <div class="agent-messages" id="agent-messages">
        <div class="agent-welcome">
          <div class="agent-welcome-title">ð Â¡Hola! Parece que estÃ¡s trabajando en MetaTronix.</div>
          <div class="agent-welcome-text">
            Soy MetaGenio, tu agente de seguimiento. Puedo ayudarte con documentos, prospectos,
            el portal y cualquier duda sobre MetaTronix. Â¿Necesitas ayuda?
          </div>
        </div>
        <div class="agent-quick-actions" id="agent-quick-actions">
          <button class="quick-action-btn" data-icon="ð" data-msg="Â¿CÃ³mo subo un documento en Docs MTX? ExplÃ­came paso a paso.">
            Â¿CÃ³mo subo un documento?
          </button>
          <button class="quick-action-btn" data-icon="ð¯" data-msg="Â¿CÃ³mo registro un nuevo lead? ExplÃ­came todos los campos y pasos.">
            Â¿CÃ³mo agrego un lead?
          </button>
          <button class="quick-action-btn" data-icon="ð" data-msg="Â¿CÃ³mo genero un documento con IA? Dame el proceso completo paso a paso.">
            Â¿CÃ³mo genero documentos?
          </button>
          <button class="quick-action-btn" data-icon="ð¢" data-msg="Â¿QuÃ© hace MetaTronix y cuÃ¡les son sus subsidiarias y productos?">
            Â¿QuÃ© hace MetaTronix?
          </button>
        </div>
      </div>

      <!-- Input -->
      <div class="agent-input-area">
        <textarea
          id="mtx-agent-input"
          placeholder="Escribe tu preguntaâ¦"
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
      <div class="agent-footer-note">CLIPPY Â· METATRONIX Â· POWERED BY CLAUDE AI</div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    initAgentDrag(btn, panel);
  }

  /* ââ Draggable MetaGenio âââââââââââââââââââââââââââââââââââ */
  function initAgentDrag(btn, panel) {
    const THRESH = 4, POS_KEY = 'mtx_agent_pos';

    function anchorTopLeft() {
      const r = btn.getBoundingClientRect();
      btn.style.bottom = 'auto'; btn.style.right = 'auto';
      btn.style.top  = clampY(r.top)  + 'px';
      btn.style.left = clampX(r.left) + 'px';
    }

    function repositionPanel() {
      if (!panel || !panel.classList.contains('open')) return;
      const br = btn.getBoundingClientRect();
      const pw = panel.offsetWidth  || 380;
      const ph = panel.offsetHeight || 520;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = br.right + 10;
      if (left + pw > vw - 8) left = br.left - pw - 10;
      left = Math.max(8, Math.min(vw - pw - 8, left));
      let top = br.bottom - ph;
      if (top < 8) top = br.top;
      top = Math.max(8, Math.min(vh - ph - 8, top));
      panel.style.bottom = 'auto'; panel.style.right = 'auto';
      panel.style.top  = top  + 'px';
      panel.style.left = left + 'px';
    }

    // Restore saved position
    try {
      const s = JSON.parse(localStorage.getItem(POS_KEY));
      if (s && typeof s.top === 'number') {
        btn.style.bottom = 'auto'; btn.style.right = 'auto';
        btn.style.top  = clampY(s.top)  + 'px';
        btn.style.left = clampX(s.left) + 'px';
      }
    } catch(_) {}

    let sx, sy, sl, st, moved = false, active = false;

    btn.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Kill animation FIRST so getBoundingClientRect is unaffected by scale/translate
      btn.style.animation = 'none';
      const r = btn.getBoundingClientRect();
      btn.style.bottom = 'auto'; btn.style.right = 'auto';
      btn.style.top  = clampY(r.top)  + 'px';
      btn.style.left = clampX(r.left) + 'px';
      active = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      sl = parseFloat(btn.style.left);
      st = parseFloat(btn.style.top);
      btn.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    btn.addEventListener('pointermove', e => {
      if (!active) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return;
      moved = true;
      btn.classList.add('dragging');
      btn.style.top  = clampY(st + dy) + 'px';
      btn.style.left = clampX(sl + dx) + 'px';
      repositionPanel();
      e.preventDefault();
    });

    btn.addEventListener('pointerup', () => {
      if (!active) return;
      active = false;
      btn.classList.remove('dragging');
      btn.style.animation = '';
      if (moved) {
        try { localStorage.setItem(POS_KEY, JSON.stringify({top: parseFloat(btn.style.top), left: parseFloat(btn.style.left)})); } catch(_) {}
      } else {
        togglePanel();
      }
    });

    btn.addEventListener('pointercancel', () => {
      active = false; btn.classList.remove('dragging'); btn.style.animation = '';
    });

    function clampX(x) { return Math.max(0, Math.min(window.innerWidth  - (btn.offsetWidth  || 88), x)); }
    function clampY(y) { return Math.max(0, Math.min(window.innerHeight - (btn.offsetHeight || 88), y)); }
  }

  /* ââ Bind events ââââââââââââââââââââââââââââââââââââââââââ */
  function bindEvents () {
    const btn    = document.getElementById('mtx-agent-btn');
    const panel  = document.getElementById('mtx-agent-panel');
    const input  = document.getElementById('mtx-agent-input');
    const send   = document.getElementById('mtx-agent-send');
    const clear  = document.getElementById('agent-clear-btn');
    const msgBox = document.getElementById('agent-messages');

    // Mode tab switching
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    // Toggle panel â initAgentDrag handles pointerup (includes non-drag clicks).
    // NO click listener here â it would fire AFTER pointerup causing a double-toggle
    // that makes the panel open and immediately close. initAgentDrag's pointerup
    // already calls togglePanel() for all clicks (pointer + touch + keyboard).
    // Fallback for keyboards only (Enter/Space on focused button):
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); }
    });

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

  /* ââ Toggle panel âââââââââââââââââââââââââââââââââââââââââ */
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

  /* ââ Mensaje de intro personalizado ââââââââââââââââââââââ */
  function sendIntroMessage () {
    const name  = (currentUser?.profile?.full_name || currentUser?.email?.split('@')[0] || 'colaborador').split(' ')[0];
    const page  = detectPage();
    const isReturning = historyLoaded && messages.length > 0;

    const intro = isReturning
      ? `Â¡Hola de nuevo, **${name}**! ð Retomamos donde lo dejamos.\n\nEstÃ¡s en **${page.name}**. Recuerda que puedo:\n- ð Explicarte cualquier funciÃ³n del portal paso a paso\n- ð§­ Guiarte a la secciÃ³n correcta\n- ð Ayudarte con leads, documentos y oportunidades\n- ð¡ Responder preguntas sobre MetaTronix y sus productos\n\nÂ¿En quÃ© te ayudo hoy?`
      : `Â¡Hola, **${name}**! ð Soy **MetaGenio**, tu asistente inteligente de MetaTronix.\n\nEstÃ¡s en **${page.name}**. AquÃ­ te cuento cÃ³mo puedo ayudarte:\n\n- ð§­ **Navegar el portal** â te explico cada secciÃ³n paso a paso\n- ð **Documentos** â cÃ³mo generarlos, editarlos y enviarlos a revisiÃ³n\n- ð¯ **Leads** â registrar prospectos, dar seguimiento y usar el Kanban\n- ð **Docs MTX** â cÃ³mo subir y consultar archivos compartidos\n- ðª **Oportunidades** â cÃ³mo usar la inteligencia de ventas\n- ð¢ **MetaTronix** â informaciÃ³n de la empresa, productos y subsidiarias\n\nPuedes preguntarme cualquier cosa con tus propias palabras. Â¿Por dÃ³nde empezamos?`;

    appendMessage('agent', intro);
  }

  /* ââ Send message âââââââââââââââââââââââââââââââââââââââââ */
  async function sendMessage (overrideText) {
    const input = document.getElementById('mtx-agent-input');
    const text  = overrideText || input?.value?.trim();
    if (!text || isTyping) return;

    // ââ Verificar acceso a Claude ââââââââââââââââââââââââââ
    if (currentUser?.id && typeof checkClaudeAccess === 'function') {
      const access = await checkClaudeAccess(currentUser.id);
      if (!access.allowed) {
        if (input && !overrideText) { input.value = ''; input.style.height = 'auto'; }
        const msgs = {
          disabled:     'ð« El acceso a MetaGenio (Claude) estÃ¡ deshabilitado por el administrador.',
          pending_auth: 'â³ Alcanzaste tu lÃ­mite mensual. Tu solicitud de autorizaciÃ³n fue enviada al SuperAdmin.',
          limit_reached:`â ï¸ LÃ­mite mensual alcanzado (${access.used}/${access.limit} usos). Solicitud enviada al administrador.`,
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

    // Detectar comando de navegaciÃ³n [NAV:/url]
    const navMatch = reply.match(/\[NAV:(\/[^\]]+)\]/);
    const cleanReply = reply.replace(/\[NAV:\/[^\]]+\]/g, '').trim();
    appendMessage('agent', cleanReply);

    if (navMatch) {
      const targetUrl = navMatch[1];
      setTimeout(() => {
        const navNote = document.createElement('div');
        navNote.className = 'nav-pill';
        navNote.innerHTML = `
          <span>LlevÃ¡ndote a <strong>${targetUrl.replace('/','').replace('.html','')}</strong>â¦</span>`;
        document.getElementById('agent-messages')?.appendChild(navNote);
        scrollMessages();
        setTimeout(() => { window.location.href = targetUrl; }, 900);
      }, 300);
    }

    // Incrementar uso Claude si la llamada fue exitosa
    if (currentUser?.id && typeof incrementClaudeUsage === 'function' && reply && !reply.startsWith('OcurriÃ³ un error')) {
      incrementClaudeUsage(currentUser.id).catch(() => {});
    }

    document.getElementById('mtx-agent-send').disabled = false;
    isTyping = false;
  }

  /* ââ Append message âââââââââââââââââââââââââââââââââââââââ */
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

  /* ââ Typing indicator âââââââââââââââââââââââââââââââââââââ */
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

  /* ââ Scroll messages ââââââââââââââââââââââââââââââââââââââ */
  function scrollMessages () {
    const msgBox = document.getElementById('agent-messages');
    if (msgBox) setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 50);
  }

  /* ââ Boot âââââââââââââââââââââââââââââââââââââââââââââââââ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure app.js auth is ready
    setTimeout(init, 1200);
  }

})();
