/* ============================================================
   MetaTronix — Team Chat Interno
   Mensajería en tiempo real entre usuarios de la plataforma
   Posición: sidebar bottom section / floating icon
   ============================================================ */
(function () {
  'use strict';
  if (document.getElementById('tchat-btn')) return;

  let currentUser = null;
  let chatOpen    = false;
  let activeRoom  = 'general';
  let subscription= null;
  let messages    = {};   // { roomId: [{...}] }
  let unreadMap   = {};   // { roomId: count }
  let users       = [];

  const ROOMS = [
    { id:'general', name:'# General',  icon:'💬', desc:'Canal del equipo' },
    { id:'ventas',  name:'# Ventas',   icon:'🎯', desc:'Equipo comercial' },
    { id:'ops',     name:'# Ops',      icon:'⚙', desc:'Operaciones' },
    { id:'alerts',  name:'⚡ Alertas', icon:'⚡', desc:'Notificaciones del sistema', readonly:true },
  ];
  const CHAT_KEY = (room) => `mtx_team_chat_${room}`;
  const READ_KEY = (room) => `mtx_chat_read_${room}`;

  function escH(s) { if(!s)return''; const d=document.createElement('div');d.textContent=String(s);return d.innerHTML; }
  function fmtTime(iso) { try { return new Date(iso).toLocaleString('es-MX',{hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'}); } catch { return ''; } }
  function getInitials(name) { if(!name)return'?'; return name.split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join(''); }

  /* ── Load/save messages (localStorage + Supabase if available) ── */
  function loadMessages(roomId) {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY(roomId)) || '[]'); } catch { return []; }
  }
  function saveMessages(roomId, msgs) {
    localStorage.setItem(CHAT_KEY(roomId), JSON.stringify(msgs.slice(-100)));
  }
  function getUnread(roomId) {
    const msgs    = loadMessages(roomId);
    const lastRead= parseInt(localStorage.getItem(READ_KEY(roomId)) || '0');
    return msgs.filter(m => m.user_id !== currentUser?.id && new Date(m.ts).getTime() > lastRead).length;
  }
  function markRead(roomId) {
    localStorage.setItem(READ_KEY(roomId), Date.now().toString());
    updateTotalBadge();
  }
  function getTotalUnread() { return ROOMS.reduce((s,r) => s + getUnread(r.id), 0); }

  /* ── Send message ────────────────────────────────────────── */
  async function sendMessage(roomId, text) {
    if (!text.trim() || !currentUser) return;
    const msg = {
      id:        'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      room_id:   roomId,
      user_id:   currentUser.id,
      user_name: currentUser.profile?.full_name || currentUser.email.split('@')[0],
      user_email:currentUser.email,
      text:      text.trim(),
      ts:        new Date().toISOString(),
    };

    // Store locally immediately
    const msgs = loadMessages(roomId);
    msgs.push(msg);
    saveMessages(roomId, msgs);
    renderMessages(roomId);

    // Try to persist to Supabase activity_logs as metadata
    if (window.getDB) {
      try {
        await window.getDB().from('activity_logs').insert({
          user_id:     currentUser.id,
          action:      'team_chat',
          entity_type: 'chat',
          entity_id:   null,
          metadata:    { room: roomId, text: text.trim().slice(0,500), msg_id: msg.id },
        });
      } catch(e) { /* localStorage is source of truth */ }
    }

    // Broadcast to localStorage (other tabs can pick it up)
    try { localStorage.setItem('mtx_chat_last', JSON.stringify(msg)); } catch {}
  }

  /* ── Listen for messages from other tabs ──────────────────── */
  function initCrossTabSync() {
    window.addEventListener('storage', e => {
      if (e.key === 'mtx_chat_last' && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue);
          if (msg.user_id === currentUser?.id) return;
          // Add to local store
          const msgs = loadMessages(msg.room_id);
          if (!msgs.find(m => m.id === msg.id)) {
            msgs.push(msg);
            saveMessages(msg.room_id, msgs);
          }
          if (msg.room_id === activeRoom && chatOpen) {
            renderMessages(activeRoom);
          } else {
            updateTotalBadge();
            if (typeof Notiflix !== 'undefined') {
              const room = ROOMS.find(r=>r.id===msg.room_id);
              Notiflix.Notify.info(`💬 ${escH(msg.user_name)} en ${room?.name||msg.room_id}: "${escH(msg.text.slice(0,50))}"`);
            }
          }
        } catch {}
      }
    });
  }

  /* ── Inject system messages ──────────────────────────────── */
  function injectSystemMessage(roomId, text) {
    const msgs = loadMessages(roomId);
    const sysMsg = { id:'sys_'+Date.now(), room_id:roomId, user_id:'system', user_name:'Sistema', text, ts:new Date().toISOString(), is_system:true };
    msgs.push(sysMsg);
    saveMessages(roomId, msgs);
    if (roomId === activeRoom && chatOpen) renderMessages(roomId);
  }

  /* ── CSS ─────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('tchat-css')) return;
    const style = document.createElement('style');
    style.id = 'tchat-css';
    style.textContent = `
      #tchat-btn {
        position: fixed; bottom: 108px; left: 20px;
        z-index: 9050; width: 44px; height: 44px;
        background: #1C2236; border: 1px solid rgba(0,212,240,.25);
        border-radius: 50%; cursor: pointer; display: flex;
        align-items: center; justify-content: center; font-size: 18px;
        transition: all .15s; box-shadow: 0 4px 14px rgba(0,0,0,.5);
      }
      #tchat-btn:hover { background: rgba(0,212,240,.15); border-color: #00D4F0; transform: scale(1.08); }
      #tchat-badge {
        position: absolute; top: -3px; right: -3px;
        width: 16px; height: 16px; border-radius: 50%;
        background: #EF4444; border: 2px solid #10141F;
        font-size: 9px; color: #fff; font-weight: 700;
        display: none; align-items: center; justify-content: center;
        font-family: 'JetBrains Mono',monospace;
      }
      #tchat-badge.show { display: flex; }

      #tchat-panel {
        position: fixed; bottom: 162px; left: 20px;
        z-index: 9049; width: 380px; height: 520px;
        max-height: calc(100vh - 170px);
        background: #141922; border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px; display: none; flex-direction: column;
        overflow: hidden; box-shadow: 0 12px 48px rgba(0,0,0,.7);
      }
      #tchat-panel.open { display: flex; }

      .tchat-header {
        padding: 12px 14px; background: #1C2236;
        border-bottom: 1px solid rgba(255,255,255,.07);
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      }
      .tchat-title { font-size: 13px; font-weight: 700; color: #E8EDF8; font-family: 'Inter', sans-serif; flex: 1; }
      .tchat-close { background: rgba(255,255,255,.08); border: none; color: rgba(255,255,255,.6); width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; }

      .tchat-layout { flex: 1; display: flex; overflow: hidden; min-height: 0; }

      .tchat-sidebar {
        width: 130px; border-right: 1px solid rgba(255,255,255,.07);
        display: flex; flex-direction: column; background: #0C0F17; overflow-y: auto;
      }
      .tchat-sidebar-section { padding: 8px 10px 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #3D4A60; }
      .tchat-room {
        display: flex; align-items: center; gap: 5px; padding: 7px 10px;
        font-size: 11px; font-weight: 500; color: #4A5568; cursor: pointer;
        transition: all .1s; position: relative; font-family: 'Inter', sans-serif;
      }
      .tchat-room:hover { color: #E8EDF8; background: rgba(255,255,255,.04); }
      .tchat-room.active { color: #00D4F0; background: rgba(0,212,240,.08); font-weight: 700; border-left: 2px solid #00D4F0; }
      .tchat-room-unread {
        position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
        background: #EF4444; color: #fff; border-radius: 8px;
        font-size: 9px; font-weight: 700; padding: 0 4px; min-width: 14px; text-align: center;
        font-family: 'JetBrains Mono', monospace;
      }

      .tchat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
      .tchat-room-header { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.07); background: #141922; flex-shrink: 0; }
      .tchat-room-name { font-size: 12px; font-weight: 700; color: #E8EDF8; font-family: 'Inter', sans-serif; }
      .tchat-room-desc { font-size: 10px; color: #4A5568; margin-top: 1px; font-family: 'Inter', sans-serif; }

      .tchat-messages { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; }
      .tchat-messages::-webkit-scrollbar { width: 3px; }
      .tchat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); }

      .tchat-msg { display: flex; gap: 8px; align-items: flex-start; }
      .tchat-msg.own { flex-direction: row-reverse; }
      .tchat-msg.system { justify-content: center; }

      .tchat-avatar {
        width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
        background: linear-gradient(135deg,rgba(0,212,240,.2),rgba(20,184,166,.2));
        border: 1px solid rgba(0,212,240,.2); display: flex; align-items: center;
        justify-content: center; font-size: 10px; font-weight: 700; color: #00D4F0;
        font-family: 'JetBrains Mono', monospace;
      }
      .tchat-msg-body { max-width: 76%; }
      .tchat-msg-header { display: flex; gap: 6px; align-items: baseline; margin-bottom: 3px; }
      .tchat-msg-name { font-size: 11px; font-weight: 700; color: #7E8FA8; font-family: 'Inter', sans-serif; }
      .tchat-msg-time { font-size: 9px; color: #3D4A60; font-family: 'JetBrains Mono', monospace; }
      .tchat-msg.own .tchat-msg-header { flex-direction: row-reverse; }
      .tchat-bubble {
        padding: 7px 11px; border-radius: 10px; font-size: 12px;
        line-height: 1.55; font-family: 'Inter', sans-serif;
        word-break: break-word;
      }
      .tchat-msg:not(.own):not(.system) .tchat-bubble { background: #1C2236; color: #C8D4E8; border-radius: 3px 10px 10px 10px; }
      .tchat-msg.own .tchat-bubble { background: rgba(0,212,240,.12); color: #E8EDF8; border: 1px solid rgba(0,212,240,.2); border-radius: 10px 3px 10px 10px; }
      .tchat-msg.system .tchat-bubble { background: rgba(245,158,11,.08); color: #A06F00; border: 1px solid rgba(245,158,11,.15); font-size: 10px; border-radius: 6px; padding: 4px 10px; }

      .tchat-input-area { padding: 8px 10px; border-top: 1px solid rgba(255,255,255,.07); background: #0C0F17; flex-shrink: 0; }
      .tchat-input-row { display: flex; gap: 6px; }
      .tchat-input {
        flex: 1; background: #1C2236; border: 1px solid rgba(255,255,255,.1);
        color: #E8EDF8; border-radius: 6px; padding: 7px 10px;
        font-size: 12px; outline: none; font-family: 'Inter', sans-serif;
        resize: none; min-height: 32px; max-height: 80px;
      }
      .tchat-input:focus { border-color: #00D4F0; }
      .tchat-input::placeholder { color: #3D4A60; }
      .tchat-send {
        width: 32px; height: 32px; background: #00D4F0; color: #000;
        border: none; border-radius: 6px; cursor: pointer; font-size: 13px;
        display: flex; align-items: center; justify-content: center;
        transition: background .1s; flex-shrink: 0;
      }
      .tchat-send:hover { background: #19DFFF; }
      .tchat-hint { font-size: 9px; color: #3D4A60; margin-top: 4px; font-family: 'Inter', sans-serif; }

      .tchat-empty { padding: 24px; text-align: center; color: #3D4A60; font-size: 12px; font-family: 'Inter', sans-serif; }
    `;
    document.head.appendChild(style);
  }

  /* ── Build UI ────────────────────────────────────────────── */
  function buildUI() {
    injectCSS();

    const btn = document.createElement('button');
    btn.id    = 'tchat-btn';
    btn.title = 'Chat Interno del Equipo';
    btn.innerHTML = `💬<span id="tchat-badge"></span>`;
    btn.style.position = 'relative';
    btn.onclick = toggleChat;

    const panel = document.createElement('div');
    panel.id = 'tchat-panel';
    panel.innerHTML = `
      <div class="tchat-header">
        <span style="font-size:16px">💬</span>
        <span class="tchat-title">Chat del Equipo</span>
        <button class="tchat-close" onclick="document.getElementById('tchat-panel').classList.remove('open');chatOpen=false">✕</button>
      </div>
      <div class="tchat-layout">
        <div class="tchat-sidebar" id="tchat-rooms-list">
          <div class="tchat-sidebar-section">Canales</div>
          ${ROOMS.map(r => `
            <div class="tchat-room ${r.id===activeRoom?'active':''}" data-room="${r.id}" onclick="tchatSetRoom('${r.id}')">
              <span>${r.icon}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${r.name.replace('#','').trim()}</span>
              <span class="tchat-room-unread" id="unread-${r.id}" style="display:none">0</span>
            </div>`).join('')}
        </div>
        <div class="tchat-main">
          <div class="tchat-room-header">
            <div class="tchat-room-name" id="tchat-room-name"># general</div>
            <div class="tchat-room-desc" id="tchat-room-desc">Canal del equipo</div>
          </div>
          <div class="tchat-messages" id="tchat-messages">
            <div class="tchat-empty">Cargando mensajes…</div>
          </div>
          <div class="tchat-input-area" id="tchat-input-area">
            <div class="tchat-input-row">
              <textarea class="tchat-input" id="tchat-input" placeholder="Mensaje a #general…" rows="1"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();tchatSend()}"
                oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px'"></textarea>
              <button class="tchat-send" onclick="tchatSend()" title="Enviar (Enter)">↑</button>
            </div>
            <div class="tchat-hint">Enter para enviar · Shift+Enter para nueva línea</div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    renderMessages(activeRoom);
    updateAllUnread();
  }

  /* ── Panel control ───────────────────────────────────────── */
  function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('tchat-panel');
    if (panel) panel.classList.toggle('open', chatOpen);
    if (chatOpen) { renderMessages(activeRoom); markRead(activeRoom); }
  }

  window.tchatSetRoom = function(roomId) {
    activeRoom = roomId;
    document.querySelectorAll('.tchat-room').forEach(el => el.classList.toggle('active', el.dataset.room === roomId));
    const room = ROOMS.find(r => r.id === roomId);
    const nameEl = document.getElementById('tchat-room-name');
    const descEl = document.getElementById('tchat-room-desc');
    if (nameEl && room) nameEl.textContent = room.name;
    if (descEl && room) descEl.textContent = room.desc;
    // Readonly rooms
    const inputArea = document.getElementById('tchat-input-area');
    if (inputArea) inputArea.style.display = room?.readonly ? 'none' : 'block';
    renderMessages(roomId);
    markRead(roomId);
  };

  window.tchatSend = function() {
    const input = document.getElementById('tchat-input');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    sendMessage(activeRoom, text);
  };

  /* ── Render messages ─────────────────────────────────────── */
  function renderMessages(roomId) {
    const container = document.getElementById('tchat-messages');
    if (!container) return;
    const msgs = loadMessages(roomId);

    if (!msgs.length) {
      const room = ROOMS.find(r => r.id === roomId);
      container.innerHTML = `<div class="tchat-empty">${room?.icon||'💬'} Sé el primero en escribir en ${room?.name||roomId}</div>`;
      return;
    }

    container.innerHTML = msgs.map(m => {
      const isMine   = m.user_id === currentUser?.id;
      const isSystem = m.is_system || m.user_id === 'system';
      const initials = getInitials(m.user_name);
      if (isSystem) return `<div class="tchat-msg system"><div class="tchat-bubble">${escH(m.text)}</div></div>`;
      return `
        <div class="tchat-msg ${isMine?'own':''}">
          ${!isMine ? `<div class="tchat-avatar">${escH(initials)}</div>` : ''}
          <div class="tchat-msg-body">
            <div class="tchat-msg-header">
              <span class="tchat-msg-name">${escH(m.user_name)}</span>
              <span class="tchat-msg-time">${fmtTime(m.ts)}</span>
            </div>
            <div class="tchat-bubble">${escH(m.text)}</div>
          </div>
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  /* ── Unread badges ───────────────────────────────────────── */
  function updateAllUnread() {
    ROOMS.forEach(r => {
      const count = getUnread(r.id);
      const el    = document.getElementById(`unread-${r.id}`);
      if (el) { el.textContent = count; el.style.display = count > 0 ? 'block' : 'none'; }
    });
    updateTotalBadge();
  }

  function updateTotalBadge() {
    const total = getTotalUnread();
    const badge = document.getElementById('tchat-badge');
    if (badge) { badge.textContent = total; badge.classList.toggle('show', total > 0); }
  }

  /* ── System message: inject lead close notifications ──────── */
  function listenForSystemEvents() {
    // Listen for lead closed events from the main app
    window.addEventListener('mtx_lead_closed', e => {
      injectSystemMessage('alerts', `🏆 Lead CERRADO: "${e.detail?.empresa}" · ${e.detail?.valor||''}`);
      updateTotalBadge();
    });
    window.addEventListener('mtx_alert_new', e => {
      injectSystemMessage('alerts', `🔔 ${e.detail?.message||''}`);
      updateTotalBadge();
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  async function init() {
    const waitForUser = () => new Promise(resolve => {
      const check = () => { if (window._mtxCurrentUser) resolve(window._mtxCurrentUser); else setTimeout(check, 500); };
      check();
    });
    currentUser = await waitForUser();

    // Seed welcome message if empty
    const general = loadMessages('general');
    if (!general.length) {
      injectSystemMessage('general', `👋 Bienvenido al chat interno de MetaTronix. Este canal es para comunicación del equipo.`);
      injectSystemMessage('ventas', `🎯 Canal de ventas activo. Comparte progresos, pide ayuda en objeciones o celebra cierres aquí.`);
      injectSystemMessage('alerts', `⚡ Las alertas automáticas del sistema aparecerán aquí: cierres, leads calientes, seguimientos vencidos.`);
    }

    buildUI();
    initCrossTabSync();
    listenForSystemEvents();

    // Periodic unread check
    setInterval(updateAllUnread, 30000);
  }

  window.teamChat = { sendMessage, injectSystemMessage };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
