/* ============================================================
   MetaTronix — ALEX: Agente de Seguimiento de Ventas
   Coaching proactivo, análisis de leads, consejos personalizados
   Posición: bottom-left (MetaGenio está en bottom-right)
   ============================================================ */
(function () {
  'use strict';
  if (document.getElementById('metafollow-btn')) return; // ya está cargado

  /* ── Config ──────────────────────────────────────────────── */
  const ALEX_NAME   = 'MetaFollow';
  const ALEX_TITLE  = 'Sales Coach';
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // revisa cada 5 min
  let   currentUser  = null;
  let   allLeads     = [];
  let   isOpen       = false;
  let   analysisCache= null;
  let   lastAnalyzed = 0;

  /* ── Stage helpers ───────────────────────────────────────── */
  const STATUS_TO_STAGE = { nuevo:'generacion', contactado:'primer_contacto', en_negociacion:'negociacion', propuesta_enviada:'propuesta', cerrado_ganado:'cierre', cerrado_perdido:'cerrado_perdido' };
  const STAGE_PROB = { generacion:.05, primer_contacto:.15, calificacion:.25, propuesta:.45, negociacion:.65, cierre:.85, postventa:1, retencion:1, fidelizacion:1, cerrado_perdido:0 };
  function getStage(l) { try { const s=JSON.parse(localStorage.getItem('mtx_stages_v2')||'{}'); return s[l.id]||STATUS_TO_STAGE[l.status]||'generacion'; } catch { return 'generacion'; } }
  function daysSince(d) { return Math.round((Date.now()-new Date(d).getTime())/86400000); }
  function fmtMXN(n) { if(!n||n===0)return'—'; return'$'+parseFloat(n).toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:0}); }
  function escH(s) { if(!s)return''; const d=document.createElement('div');d.textContent=String(s);return d.innerHTML; }

  /* ── Sales tips library ──────────────────────────────────── */
  const TIPS = [
    { cat:'seguimiento', tip:'El 80% de las ventas se cierran después del 5° contacto. La mayoría de vendedores se rinden en el 2°. Sé persistente.' },
    { cat:'cierre', tip:'En lugar de preguntar "¿qué le parece?", pregunta "¿cuándo podemos arrancar?" — asume el cierre.' },
    { cat:'propuesta', tip:'Una propuesta sin una llamada de seguimiento tiene 40% menos probabilidad de cerrar. Agenda la llamada ANTES de enviarla.' },
    { cat:'objeciones', tip:'La objeción "es muy caro" casi siempre significa "no veo el valor suficiente". Regresa al problema que resuelves.' },
    { cat:'calificacion', tip:'BANT (Budget, Authority, Need, Timeline) no es suficiente. Agrega MEDDIC para deals complejos.' },
    { cat:'urgencia', tip:'Un lead sin fecha de decisión raramente cierra solo. Crea urgencia legítima: "tenemos 2 slots de implementación disponibles este mes."' },
    { cat:'linkedin', tip:'Un mensaje de LinkedIn personalizado de 3 líneas tiene 8x más respuesta que uno genérico. Menciona algo específico de su empresa.' },
    { cat:'email', tip:'El mejor horario para emails de ventas: martes/miércoles 10am-11am o 2pm-3pm. Tasas de apertura 40% mayores.' },
    { cat:'confianza', tip:'Antes de hablar de precio, asegúrate de que el prospecto haya articulado el costo de NO resolver su problema.' },
    { cat:'pipeline', tip:'Un pipeline sano tiene leads en todas las etapas, no solo al inicio. Si solo tienes generación, tienes un problema de conversión.' },
    { cat:'whitespace', tip:'Tus mejores prospectos están entre tus clientes actuales. Identifica oportunidades de upsell antes de buscar nuevos clientes.' },
    { cat:'referidos', tip:'Pide referidos inmediatamente después del cierre, cuando el cliente está más entusiasmado. No esperes meses.' },
  ];

  /* ── Coaching engine ─────────────────────────────────────── */
  function analyzeLeads(leads, userId) {
    const myLeads = leads.filter(l => !l.user_id || l.user_id === userId);
    const activos  = myLeads.filter(l => !['cerrado_ganado','cerrado_perdido'].includes(l.status));
    const ganados  = myLeads.filter(l => ['cierre','postventa','retencion','fidelizacion'].includes(getStage(l)));
    const stale    = activos.filter(l => daysSince(l.updated_at) > 7);
    const overdue  = activos.filter(l => l.seguimiento && new Date(l.seguimiento) < new Date());
    const forecast = myLeads.reduce((s,l) => s + (parseFloat(l.valor_estimado)||0) * (STAGE_PROB[getStage(l)]||0), 0);
    const pipeline = activos.reduce((s,l) => s + (parseFloat(l.valor_estimado)||0), 0);
    const winRate  = myLeads.length ? Math.round((ganados.length/myLeads.length)*100) : 0;

    // Specific insights
    const insights = [];

    // Critical: overdue follow-ups
    if (overdue.length > 0) {
      overdue.slice(0,3).forEach(l => {
        insights.push({
          level: 'critical',
          icon: '🔴',
          title: `Seguimiento vencido: ${l.empresa}`,
          body: `El seguimiento con ${escH(l.empresa)} venció el ${l.seguimiento}. Contacta HOY — cada día que pasa reduce la probabilidad de cierre un 10%.`,
          action: { label:'Abrir lead', url:'/leads.html' },
        });
      });
    }

    // High: stale leads
    if (stale.length > 0) {
      const worstStale = stale.sort((a,b) => daysSince(b.updated_at) - daysSince(a.updated_at))[0];
      if (worstStale) {
        insights.push({
          level: 'warning',
          icon: '🟡',
          title: `${stale.length} lead${stale.length>1?'s':''} sin actividad`,
          body: `"${escH(worstStale.empresa)}" lleva ${daysSince(worstStale.updated_at)} días sin actividad. Un lead inactivo pierde temperatura rápidamente. ¿Ya tienes su próximo paso definido?`,
          action: { label:'Ver leads', url:'/leads.html' },
        });
      }
    }

    // Win rate analysis
    if (myLeads.length >= 3 && winRate < 20) {
      insights.push({
        level: 'warning',
        icon: '📊',
        title: `Win rate bajo: ${winRate}%`,
        body: `Tu tasa de cierre es del ${winRate}%. El promedio B2B es 20-30%. Revisa tu proceso de calificación — es posible que estés trabajando leads no calificados.`,
        action: { label:'Ver reportes', url:'/home.html#reportes' },
      });
    }

    // Hot deal: high value in negotiation
    const hotDeals = activos.filter(l => ['negociacion','propuesta'].includes(getStage(l)) && (l.valor_estimado||0) > 200000);
    if (hotDeals.length > 0) {
      const hot = hotDeals[0];
      insights.push({
        level: 'good',
        icon: '🔥',
        title: `Deal caliente: ${hot.empresa}`,
        body: `${escH(hot.empresa)} (${fmtMXN(hot.valor_estimado)}) está en ${getStage(hot)}. Este es tu deal más valioso en esta etapa. Priorízalo sobre todo lo demás.`,
        action: { label:'Ver deal', url:'/leads.html' },
      });
    }

    // Pipeline health
    const stagesPresent = new Set(activos.map(l => getStage(l))).size;
    if (activos.length > 0 && stagesPresent < 3) {
      insights.push({
        level: 'info',
        icon: '🎯',
        title: 'Pipeline concentrado en pocas etapas',
        body: `Tu pipeline tiene leads en solo ${stagesPresent} etapa${stagesPresent>1?'s':''}. Un pipeline sano tiene leads en todas las etapas para asegurar flujo continuo de cierres.`,
        action: { label:'Ver pipeline', url:'/leads.html' },
      });
    }

    // Daily tip (rotates)
    const tipIndex = new Date().getDate() % TIPS.length;
    insights.push({
      level: 'tip',
      icon: '💡',
      title: 'Consejo del día',
      body: TIPS[tipIndex].tip,
    });

    return { myLeads, activos, ganados, stale, overdue, forecast, pipeline, winRate, insights };
  }

  function getWelcomeMessage(analysis) {
    const name = currentUser?.profile?.full_name?.split(' ')[0] || 'vendedor';
    const { activos, stale, overdue, winRate } = analysis;
    if (overdue.length > 0)
      return `Hola ${name}. Tienes ${overdue.length} seguimiento${overdue.length>1?'s':''} vencido${overdue.length>1?'s':''}. Empieza el día por ahí.`;
    if (stale.length > 0)
      return `Hola ${name}. ${stale.length} de tus leads llevan más de 7 días sin actividad. Vamos a atacarlos.`;
    if (activos.length === 0)
      return `Hola ${name}. Tu pipeline está vacío. Es momento de prospectar activamente.`;
    return `Hola ${name}. Tienes ${activos.length} leads activos con forecast de ${fmtMXN(analysis.forecast)}. ¿Cómo te puedo ayudar hoy?`;
  }

  /* ── SVG Avatar ──────────────────────────────────────────── */
  function alexSVG(cls) {
    return `<svg class="${cls}" width="88" height="88" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="44" cy="44" r="40" fill="#0C0F17" stroke="#00D4F0" stroke-width="2"/>
      <circle cx="44" cy="44" r="36" fill="#141922"/>
      <!-- Body: suit jacket -->
      <rect x="28" y="56" width="32" height="20" rx="4" fill="#1A2030"/>
      <rect x="40" y="56" width="8" height="20" fill="#0C0F17"/>
      <line x1="44" y1="56" x2="44" y2="76" stroke="#00D4F0" stroke-width="1"/>
      <!-- Collar / tie -->
      <polygon points="44,56 40,62 44,68 48,62" fill="#00D4F0" opacity=".8"/>
      <!-- Head -->
      <circle cx="44" cy="38" r="16" fill="#1C2236"/>
      <circle cx="44" cy="38" r="15" fill="#212840"/>
      <!-- Eyes -->
      <ellipse cx="37" cy="36" rx="3" ry="3.5" fill="#0C0F17"/>
      <ellipse cx="51" cy="36" rx="3" ry="3.5" fill="#0C0F17"/>
      <circle cx="38.2" cy="35.2" r="1.2" fill="#00D4F0"/>
      <circle cx="52.2" cy="35.2" r="1.2" fill="#00D4F0"/>
      <!-- Eyebrows -->
      <path d="M34 32 Q37 30 40 32" stroke="#7E8FA8" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M48 32 Q51 30 54 32" stroke="#7E8FA8" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <!-- Smile -->
      <path d="M38 43 Q44 48 50 43" stroke="#00D4F0" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Chart icon (data/analytics) -->
      <rect x="20" y="64" width="3" height="6" fill="#00D4F0" opacity=".7" rx="1"/>
      <rect x="24" y="61" width="3" height="9" fill="#00D4F0" opacity=".8" rx="1"/>
      <rect x="28" y="58" width="3" height="12" fill="#00D4F0" rx="1"/>
    </svg>`;
  }

  /* ── CSS ────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('metafollow-css')) return;
    const style = document.createElement('style');
    style.id = 'metafollow-css';
    style.textContent = `
      @keyframes alex-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      @keyframes alex-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(0,212,240,.4)} 50%{box-shadow:0 0 0 8px rgba(0,212,240,0)} }
      @keyframes alex-in { from{opacity:0;transform:translateY(12px) scale(.95)} to{opacity:1;transform:none} }

      #metafollow-btn {
        position: fixed; bottom: 20px; left: 20px;
        z-index: 9100; width: 80px; height: 80px;
        background: transparent; border: none; cursor: grab;
        outline: none; padding: 0;
        filter: drop-shadow(0 4px 14px rgba(0,212,240,.3));
        animation: alex-float 3.5s ease-in-out infinite;
        transition: filter .2s;
        user-select: none; touch-action: none;
      }
      #metafollow-btn:hover { filter: drop-shadow(0 6px 20px rgba(0,212,240,.5)); }
      #metafollow-btn.has-alert { animation: alex-pulse 2s ease-in-out infinite; }
      #metafollow-btn.dragging { cursor: grabbing; animation: none; filter: drop-shadow(0 8px 24px rgba(0,212,240,.7)); opacity:.9; }

      #metafollow-badge {
        position: absolute; top: 0px; right: 0px;
        width: 18px; height: 18px; border-radius: 50%;
        background: #EF4444; border: 2px solid #10141F;
        font-size: 10px; color: #fff; font-weight: 700;
        display: none; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono', monospace;
      }
      #metafollow-badge.show { display: flex; }

      #metafollow-panel {
        position: fixed; bottom: 20px; left: 108px;
        z-index: 9099; width: 360px; height: 540px;
        max-height: calc(100vh - 40px);
        background: #141922; border: 1px solid rgba(0,212,240,.2);
        border-radius: 14px; display: flex; flex-direction: column;
        overflow: hidden; box-shadow: 0 12px 48px rgba(0,0,0,.7), 0 0 0 1px rgba(0,212,240,.1);
        transform: scale(.93); transform-origin: bottom left;
        opacity: 0; pointer-events: none;
        transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s;
      }
      #metafollow-panel.open { transform: scale(1); opacity: 1; pointer-events: all; }

      .mf-header {
        padding: 14px 16px; display: flex; align-items: center; gap: 12px;
        background: linear-gradient(135deg, #0C0F17 0%, #141922 100%);
        border-bottom: 1px solid rgba(0,212,240,.12); flex-shrink: 0;
      }
      .mf-avatar-sm { width: 44px; height: 44px; flex-shrink: 0; }
      .mf-name { font-size: 14px; font-weight: 700; color: #E8EDF8; font-family: 'Inter', sans-serif; }
      .mf-status { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,.6); font-family: 'Inter', sans-serif; }
      .mf-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #00D4F0; animation: status-blink 2s ease-in-out infinite; }
      @keyframes status-blink { 0%,100%{opacity:1} 50%{opacity:.3} }

      .mf-tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,.07); flex-shrink: 0; }
      .mf-tab {
        flex: 1; padding: 8px 0; font-size: 11px; font-weight: 600;
        color: rgba(255,255,255,.75); cursor: pointer; border-bottom: 2px solid transparent;
        margin-bottom: -1px; transition: all .1s; background: none; border-top: none;
        border-left: none; border-right: none; font-family: 'Inter', sans-serif;
        letter-spacing: .02em; text-transform: uppercase;
      }
      .mf-tab.active { color: #00D4F0; border-bottom-color: #00D4F0; }
      .mf-tab:hover:not(.active) { color: #fff; }

      .mf-body { flex: 1; overflow-y: auto; padding: 12px; }
      .mf-body::-webkit-scrollbar { width: 3px; }
      .mf-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); }

      /* Insights */
      .mf-insight {
        background: #1C2236; border: 1px solid rgba(255,255,255,.08);
        border-radius: 8px; padding: 11px 13px; margin-bottom: 8px;
        animation: alex-in .2s ease;
      }
      .mf-insight.critical { border-left: 3px solid #EF4444; background: rgba(239,68,68,.06); }
      .mf-insight.warning  { border-left: 3px solid #F59E0B; background: rgba(245,158,11,.06); }
      .mf-insight.good     { border-left: 3px solid #10B981; background: rgba(16,185,129,.06); }
      .mf-insight.info     { border-left: 3px solid #3B82F6; background: rgba(59,130,246,.06); }
      .mf-insight.tip      { border-left: 3px solid #00D4F0; background: rgba(0,212,240,.06); }
      .mf-insight-head { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
      .mf-insight-icon { font-size: 14px; }
      .mf-insight-title { font-size: 12px; font-weight: 700; color: #E8EDF8; font-family: 'Inter', sans-serif; }
      .mf-insight-body { font-size: 11.5px; color: #B8C8DC; line-height: 1.6; font-family: 'Inter', sans-serif; }
      .mf-insight-action {
        display: inline-flex; align-items: center; gap: 4px;
        margin-top: 7px; padding: 4px 10px; background: rgba(0,212,240,.1);
        color: #00D4F0; border: 1px solid rgba(0,212,240,.2);
        border-radius: 4px; font-size: 11px; font-weight: 600;
        cursor: pointer; text-decoration: none; font-family: 'Inter', sans-serif;
        transition: background .1s;
      }
      .mf-insight-action:hover { background: rgba(0,212,240,.18); }

      /* Stats tab */
      .mf-stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
      .mf-stat-row:last-child { border-bottom: none; }
      .mf-stat-lbl { font-size: 12px; color: #B8C8DC; font-family: 'Inter', sans-serif; }
      .mf-stat-val { font-size: 12px; font-weight: 700; color: #E8EDF8; font-family: 'JetBrains Mono', monospace; }

      /* Chat */
      .mf-msgs { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 7px; }
      .mf-msg { max-width: 88%; font-size: 12px; line-height: 1.6; font-family: 'Inter', sans-serif; }
      .mf-msg.alex { align-self: flex-start; background: #1C2236; color: #C8D4E8; padding: 9px 12px; border-radius: 10px 10px 10px 3px; border: 1px solid rgba(0,212,240,.1); }
      .mf-msg.user { align-self: flex-end; background: rgba(0,212,240,.12); color: #E8EDF8; padding: 9px 12px; border-radius: 10px 10px 3px 10px; border: 1px solid rgba(0,212,240,.2); }
      .mf-input-wrap { padding: 10px 12px; border-top: 1px solid rgba(255,255,255,.07); display: flex; gap: 7px; flex-shrink: 0; background: #0C0F17; }
      .mf-input { flex: 1; background: #1C2236; border: 1px solid rgba(255,255,255,.1); color: #E8EDF8; border-radius: 6px; padding: 8px 11px; font-size: 12px; outline: none; font-family: 'Inter', sans-serif; }
      .mf-input:focus { border-color: #00D4F0; }
      .mf-send { padding: 7px 12px; background: #00D4F0; color: #000; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; transition: background .1s; }
      .mf-send:hover { background: #19DFFF; }

      .mf-close { background: rgba(255,255,255,.1); border: none; color: rgba(255,255,255,.7); width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; transition: all .1s; margin-left: auto; flex-shrink: 0; }
      .mf-close:hover { background: rgba(255,255,255,.2); color: #fff; }

      .mf-refresh { background: rgba(0,212,240,.1); border: 1px solid rgba(0,212,240,.2); color: #00D4F0; border-radius: 5px; padding: 4px 9px; font-size: 10px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; margin-left: auto; }
      .mf-refresh:hover { background: rgba(0,212,240,.2); }
    `;
    document.head.appendChild(style);
  }

  /* ── Build UI ────────────────────────────────────────────── */
  function buildUI() {
    injectCSS();

    // Button
    const btn = document.createElement('button');
    btn.id = 'metafollow-btn';
    btn.title = 'MetaFollow — Sales Coach IA (arrastra para mover)';
    btn.innerHTML = alexSVG('metafollow-svg') + `<span id="metafollow-badge"></span>`;
    // click handled inside makeDraggable (only fires when not dragging)

    // Panel
    const panel = document.createElement('div');
    panel.id = 'metafollow-panel';
    panel.innerHTML = `
      <div class="metafollow-header">
        ${alexSVG('metafollow-avatar-sm')}
        <div>
          <div class="metafollow-name">${ALEX_NAME}</div>
          <div class="metafollow-status"><div class="metafollow-status-dot"></div><span id="mf-status-text">Analizando leads…</span></div>
        </div>
        <button class="mf-close" onclick="closeMetaFollow()">✕</button>
      </div>
      <div class="metafollow-tabs">
        <button class="metafollow-tab active" data-tab="insights" onclick="metafollowTab('insights',this)">💡 Insights</button>
        <button class="metafollow-tab" data-tab="stats" onclick="metafollowTab('stats',this)">📊 Stats</button>
        <button class="metafollow-tab" data-tab="chat" onclick="metafollowTab('chat',this)">💬 Chat IA</button>
      </div>
      <div id="mf-tab-insights" class="metafollow-body" style="padding:10px">
        <div id="mf-insights-list"><div style="text-align:center;padding:24px;color:#B8C8DC;font-size:13px">Analizando tus leads…</div></div>
      </div>
      <div id="mf-tab-stats" class="metafollow-body" style="display:none">
        <div id="mf-stats-body" style="padding:4px 0"></div>
      </div>
      <div id="mf-tab-chat" style="display:none;flex:1;flex-direction:column;overflow:hidden;height:100%">
        <div class="metafollow-msgs" id="mf-msgs"></div>
        <div class="metafollow-input-wrap">
          <input class="metafollow-input" id="mf-chat-input" placeholder="Pregúntame algo sobre tus leads…" onkeydown="if(event.key==='Enter')metafollowChat()">
          <button class="metafollow-send" onclick="metafollowChat()">→</button>
        </div>
      </div>`;

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    makeDraggable(btn);
  }

  /* ── Draggable button ────────────────────────────────────── */
  function makeDraggable(btn) {
    const DRAG_THRESHOLD = 5; // px before we consider it a drag
    const POS_KEY = 'mtx_metafollow_pos';

    // Restore saved position
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY));
      if (saved && typeof saved.top === 'number' && typeof saved.left === 'number') {
        btn.style.top    = clampY(saved.top)  + 'px';
        btn.style.left   = clampX(saved.left) + 'px';
        btn.style.bottom = 'auto';
        btn.style.right  = 'auto';
      }
    } catch (_) {}

    let startX, startY, startLeft, startTop, hasMoved = false, active = false;

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      active   = true;
      hasMoved = false;
      const r  = btn.getBoundingClientRect();
      startX   = e.clientX;
      startY   = e.clientY;
      startLeft = r.left;
      startTop  = r.top;
      btn.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    btn.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!hasMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        hasMoved = true;
        btn.classList.add('dragging');
        btn.style.bottom = 'auto';
        btn.style.right  = 'auto';
      }
      if (!hasMoved) return;
      btn.style.top  = clampY(startTop  + dy) + 'px';
      btn.style.left = clampX(startLeft + dx) + 'px';
      repositionPanel();
    });

    btn.addEventListener('pointerup', (e) => {
      if (!active) return;
      active = false;
      btn.classList.remove('dragging');
      if (hasMoved) {
        // Persist position
        const r = btn.getBoundingClientRect();
        try { localStorage.setItem(POS_KEY, JSON.stringify({top: r.top, left: r.left})); } catch (_) {}
        // Prevent click from toggling the panel after a drag
        btn.addEventListener('click', stopOnce, true);
      } else {
        togglePanel();
      }
    });

    function stopOnce(e) { e.stopImmediatePropagation(); e.preventDefault(); btn.removeEventListener('click', stopOnce, true); }

    function clampX(x) { return Math.max(0, Math.min(window.innerWidth  - btn.offsetWidth,  x)); }
    function clampY(y) { return Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, y)); }
  }

  /* ── Reposition panel relative to current btn position ──── */
  function repositionPanel() {
    const btn   = document.getElementById('metafollow-btn');
    const panel = document.getElementById('metafollow-panel');
    if (!btn || !panel) return;

    const bRect = btn.getBoundingClientRect();
    const pW    = panel.offsetWidth  || 360;
    const pH    = panel.offsetHeight || 540;
    const gap   = 10;
    const vp    = { w: window.innerWidth, h: window.innerHeight };

    // Prefer right; fall back left
    let left = bRect.right + gap;
    if (left + pW > vp.w - 8) left = bRect.left - pW - gap;
    left = Math.max(8, Math.min(vp.w - pW - 8, left));

    // Align bottom of panel with bottom of btn; clamp within viewport
    let top = bRect.bottom - pH;
    if (top < 8) top = bRect.top;
    top = Math.max(8, Math.min(vp.h - pH - 8, top));

    panel.style.top    = top  + 'px';
    panel.style.left   = left + 'px';
    panel.style.bottom = 'auto';
    panel.style.right  = 'auto';
    // update transform-origin to animate from the btn side
    panel.style.transformOrigin = left > bRect.left ? 'bottom left' : 'bottom right';
  }

  /* ── Panel control ───────────────────────────────────────── */
  function togglePanel() {
    isOpen ? closeMetaFollow() : openMetaFollow();
  }

  function openMetaFollow() {
    const panel = document.getElementById('metafollow-panel');
    const btn   = document.getElementById('metafollow-btn');
    if (!panel || !btn) return;
    isOpen = true;
    repositionPanel();
    panel.classList.add('open');
    btn.classList.add('open');
    runAnalysis();
  }

  function closeMetaFollow() {
    const panel = document.getElementById('metafollow-panel');
    const btn   = document.getElementById('metafollow-btn');
    if (!panel || !btn) return;
    isOpen = false;
    panel.classList.remove('open');
    btn.classList.remove('open');
  }
  // Expose close globally so the inline onclick can reach it
  window.closeMetaFollow = closeMetaFollow;

  window.metafollowTab = function(tab, btnEl) {
    ['insights','stats','chat'].forEach(t => {
      const el = document.getElementById(`mf-tab-${t}`);
      if (el) el.style.display = t === tab ? (t === 'chat' ? 'flex' : 'block') : 'none';
    });
    document.querySelectorAll('.mf-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'chat' && !document.getElementById('mf-msgs')?.children.length) {
      addMFMsg('Hola! Soy MetaFollow, tu agente de ventas. Pregúntame sobre tus leads, consejos de cierre, o cómo manejar objeciones específicas.');
    }
    if (tab === 'stats') renderStats();
  };

  /* ── Analysis ────────────────────────────────────────────── */
  async function runAnalysis() {
    if (!currentUser || !window.getDB) return;
    if (Date.now() - lastAnalyzed < 60000 && analysisCache) { renderInsights(analysisCache); return; }

    setStatus('Analizando leads…');
    try {
      const { data } = await window.getDB().from('leads').select('*').order('updated_at',{ascending:false});
      allLeads = data || [];
      analysisCache = analyzeLeads(allLeads, currentUser.id);
      lastAnalyzed  = Date.now();
      renderInsights(analysisCache);
      renderStats();
      updateBadge(analysisCache);
      setStatus(`${allLeads.length} leads analizados`);
    } catch(e) {
      setStatus('Error al cargar leads');
    }
  }

  function setStatus(txt) {
    const el = document.getElementById('mf-status-text');
    if (el) el.textContent = txt;
  }

  function renderInsights(analysis) {
    const list = document.getElementById('mf-insights-list');
    if (!list) return;
    const { insights } = analysis;

    // Welcome message
    const welcome = getWelcomeMessage(analysis);
    list.innerHTML = `
      <div style="background:rgba(0,212,240,.07);border:1px solid rgba(0,212,240,.15);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#C8D4E8;font-family:'Inter',sans-serif;line-height:1.6">
        ${escH(welcome)}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#8BAFC8">Insights Personalizados</div>
        <button class="metafollow-refresh" onclick="lastAnalyzed=0;runAnalysis()">↻ Actualizar</button>
      </div>
      ${insights.map(i => `
        <div class="metafollow-insight ${i.level}">
          <div class="metafollow-insight-head">
            <span class="metafollow-insight-icon">${i.icon}</span>
            <span class="metafollow-insight-title">${i.title}</span>
          </div>
          <div class="metafollow-insight-body">${i.body}</div>
          ${i.action ? `<a class="metafollow-insight-action" href="${i.action.url}">${i.action.label} →</a>` : ''}
        </div>`).join('')}`;
  }

  function renderStats() {
    const body = document.getElementById('mf-stats-body');
    if (!body || !analysisCache) { body.innerHTML = '<div style="color:#B8C8DC;text-align:center;padding:20px;font-size:12px">Abre la pestaña Insights primero</div>'; return; }
    const { myLeads, activos, ganados, stale, overdue, forecast, pipeline, winRate } = analysisCache;

    const rows = [
      ['Mis leads totales', myLeads.length],
      ['Leads activos', activos.length],
      ['Deals ganados', ganados.length],
      ['Win Rate', winRate + '%'],
      ['Pipeline bruto', window.fmtMXN ? window.fmtMXN(pipeline) : '$'+Math.round(pipeline).toLocaleString('es-MX')],
      ['Forecast ponderado', window.fmtMXN ? window.fmtMXN(forecast) : '$'+Math.round(forecast).toLocaleString('es-MX')],
      ['Sin actividad >7d', stale.length],
      ['Seguimiento vencido', overdue.length],
    ];
    body.innerHTML = rows.map(([l,v]) => `<div class="metafollow-stat-row"><span class="metafollow-stat-lbl">${l}</span><span class="metafollow-stat-val">${v}</span></div>`).join('');
  }

  function updateBadge(analysis) {
    const badge = document.getElementById('metafollow-badge');
    const btn   = document.getElementById('metafollow-btn');
    const criticals = analysis.insights.filter(i => i.level === 'critical').length;
    if (badge) { badge.textContent = criticals; badge.classList.toggle('show', criticals > 0); }
    if (btn)   btn.classList.toggle('has-alert', criticals > 0);
  }

  /* ── AI Chat ─────────────────────────────────────────────── */
  function addMFMsg(text) {
    const msgs = document.getElementById('mf-msgs');
    if (!msgs) return;
    const div  = document.createElement('div');
    div.className = 'metafollow-msg alex';
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addUserMsg(text) {
    const msgs = document.getElementById('mf-msgs');
    if (!msgs) return;
    const div  = document.createElement('div');
    div.className = 'metafollow-msg user';
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  window.metafollowChat = async function() {
    const input = document.getElementById('mf-chat-input');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';
    addUserMsg(text);

    // Try LLM first
    if (window.CRM_LLM?.engine) {
      try {
        const context = analysisCache ? `El usuario tiene ${analysisCache.activos.length} leads activos, win rate de ${analysisCache.winRate}%, ${analysisCache.stale.length} leads sin actividad y ${analysisCache.overdue.length} seguimientos vencidos.` : '';
        const response = await window.CRM_LLM.chat(
          `Eres MetaFollow, un experto agente de ventas B2B para MetaTronix (empresa de IA en LATAM). Das consejos concisos, específicos y accionables. Máximo 3-4 oraciones. ${context}`,
          text
        );
        addMFMsg(response);
        return;
      } catch(e) {}
    }

    // Fallback: keyword-based responses
    const lower = text.toLowerCase();
    const responses = {
      'objecion|caro|precio|presupuesto': '💡 La objeción de precio es casi siempre una objeción de valor. Pregunta: "Dejando el precio de lado por un momento, ¿esta solución resuelve tu problema?" Si dice sí, vuelve al ROI. Si el cliente ve el valor, el precio se convierte en una negociación, no en un bloqueo.',
      'seguimiento|follow.up|contactar': '📞 La regla de oro: sigue hasta obtener un "sí" o un "no" definitivo. Un "no me interesa" es mejor que el silencio. Intenta variar el canal (email → WhatsApp → LinkedIn → llamada). Los mejores vendedores hacen 5-8 contactos por lead.',
      'cierre|cerrar|close': '🏆 Para acelerar el cierre: crea urgencia legítima (no falsa), involucra al decisor final, y pregunta directamente "¿qué necesitamos para avanzar esta semana?"',
      'propuesta|cotizaci': '📋 Envía la propuesta en una videollamada, nunca solo por email. El 70% de propuestas enviadas sin llamada no reciben respuesta. Agenda el follow-up ANTES de enviarla.',
      'pipeline|lead': '📊 Un pipeline sano tiene el doble de lo que planeas cerrar. Si tu meta es $1M, necesitas $2M en pipeline activo.',
    };
    for (const [pattern, resp] of Object.entries(responses)) {
      if (new RegExp(pattern, 'i').test(lower)) { addMFMsg(resp); return; }
    }
    addMFMsg(`Entiendo. Basado en tu pipeline actual (${analysisCache?.activos?.length||0} leads activos), mi recomendación es priorizar los leads en etapa de negociación y propuesta primero. ¿Quieres que analice algún lead específico?`);
  };

  /* ── Periodic proactive alerts ───────────────────────────── */
  function startMonitoring() {
    setInterval(async () => {
      if (!currentUser) return;
      lastAnalyzed = 0; // force re-analysis
      await runAnalysis();
      // Show proactive notification if critical items found
      if (analysisCache?.insights?.some(i => i.level === 'critical') && !isOpen) {
        if (typeof Notiflix !== 'undefined') {
          Notiflix.Notify.warning(`⚠️ MetaFollow: Tienes seguimientos vencidos que requieren atención`);
        }
      }
    }, CHECK_INTERVAL_MS);
  }

  /* ── Init ────────────────────────────────────────────────── */
  async function init() {
    // Wait for auth to be ready
    const waitForUser = () => new Promise(resolve => {
      const check = () => {
        if (window._mtxCurrentUser) resolve(window._mtxCurrentUser);
        else setTimeout(check, 500);
      };
      check();
    });

    currentUser = await waitForUser();
    buildUI();
    await runAnalysis();
    startMonitoring();
  }

  // Expose globally for other scripts
  window.metaFollowAgent = { runAnalysis, addMFMsg };

  // Start
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
