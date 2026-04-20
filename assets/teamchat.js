/* ============================================================
   MetaTronix — Team Chat Interno
   Mensajería en tiempo real entre usuarios + DMs privados
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
  let users       = [];   // loaded from Supabase profiles

  const ROOMS = [
    { id:'general', name:'# General',  icon:'💬', desc:'Canal del equipo' },
    { id:'ventas',  name:'# Ventas',   icon:'🎯', desc:'Equipo comercial' },
    { id:'ops',     name:'# Ops',      icon:'⚙', desc:'Operaciones' },
    { id:'alerts',  name:'⚡ Alertas', icon:'⚡', desc:'Notificaciones del sistema', readonly:true },
  ];
  const CHAT_KEY = (room) => `mtx_team_chat_${room}`;
  const DM_KEY   = (userId) => `mtx_team_chat_dm_${userId}`;
  const READ_KEY = (room) => `mtx_chat_read_${room}`;

  /* ── DM helpers ─────────────────────────────────────────── */
  function isDM(roomId)       { return typeof roomId === 'string' && roomId.startsWith('dm:'); }
  function dmOtherId(roomId)  { return roomId.replace('dm:', ''); }
  function dmRoomId(userId)   { return 'dm:' + userId; }
  function dmStorageKey(roomId) {
    // canonical: always sort the two user IDs so both sides share the same key
    if (!currentUser) return CHAT_KEY(roomId);
    const ids = [currentUser.id, dmOtherId(roomId)].sort();
    return `mtx_team_chat_dm_${ids[0]}_${ids[1]}`;
  }

  function escH(s) { if(!s)return''; const d=document.createElement('div');d.textContent=String(s);return d.innerHTML; }
  function fmtTime(iso) { try { return new Date(iso).toLocaleString('es-MX',{hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'}); } catch { return ''; } }
  function getInitials(name) { if(!name)return'?'; return name.split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join(''); }

  /* ── Load users from Supabase ────────────────────────────── */
  async function loadUsers() {
    if (!window.getDB) return;
    try {
      const { data, error } = await window.getDB()
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .order('full_name');
      if (!error && data) {
        users = data.filter(u => u.id !== currentUser?.id);
        renderDMList();
      }
    } catch(e) { /* graceful fail */ }
  }

  window.tchatReloadUsers = loadUsers;

  /* ── Load/save messages ──────────────────────────────────── */
  function storageKey(roomId) {
    return isDM(roomId) ? dmStorageKey(roomId) : CHAT_KEY(roomId);
  }
  function loadMessages(roomId) {
    try { return JSON.parse(localStorage.getItem(storageKey(roomId)) || '[]'); } catch { return []; }
  }
  function saveMessages(roomId, msgs) {
    localStorage.setItem(storageKey(roomId), JSON.stringify(msgs.slice(-100)));
  }
  /* ── Sync messages from Supabase (cross-user persistence) ── */
  async function syncFromSupabase(roomId) {
    if (!window.getDB || !currentUser) return;
    try {
      const isDm = isDM(roomId);
      let q = window.getDB()
        .from('activity_logs')
        .select('id, user_id, metadata, created_at')
        .eq('entity_type', 'chat')
        .order('created_at', { ascending: true })
        .limit(150);

      if (isDm) {
        const otherId = dmOtherId(roomId);
        const myId    = currentUser.id;
        q = q.eq('action', 'team_chat_dm').or(
          `and(user_id.eq.${myId},metadata->>to_user.eq.${otherId}),and(user_id.eq.${otherId},metadata->>to_user.eq.${myId})`
        );
      } else {
        q = q.eq('action', 'team_chat').filter('metadata->>room', 'eq', roomId);
      }

      const { data, error } = await q;
      if (error || !data?.length) return;

      const remote = data.map(row => ({
        id:        row.metadata?.msg_id || 'sb_' + row.id,
        room_id:   roomId,
        user_id:   row.user_id,
        user_name: row.metadata?.user_name || 'Usuario',
        text:      row.metadata?.text || '',
        ts:        row.created_at,
        is_dm:     isDm,
        ...(isDm ? { to_user: row.metadata?.to_user } : {}),
      }));

      const local  = loadMessages(roomId);
      const seenIds = new Set(local.map(m => m.id));
      const merged  = [...local, ...remote.filter(m => !seenIds.has(m.id))];
      merged.sort((a, b) => new Date(a.ts) - new Date(b.ts));
      saveMessages(roomId, merged);
      if (roomId === activeRoom && chatOpen) renderMessages(roomId);
    } catch(e) { /* fail silently */ }
  }

  function getUnread(roomId) {
    const msgs     = loadMessages(roomId);
    const lastRead = parseInt(localStorage.getItem(READ_KEY(roomId)) || '0');
    return msgs.filter(m => m.user_id !== currentUser?.id && new Date(m.ts).getTime() > lastRead).length;
  }
  function markRead(roomId) {
    localStorage.setItem(READ_KEY(roomId), Date.now().toString());
    updateTotalBadge();
    updateDMUnread(roomId);
  }
  function getTotalUnread() {
    const chanUnread = ROOMS.reduce((s,r) => s + getUnread(r.id), 0);
    const dmUnread   = users.reduce((s,u) => s + getUnread(dmRoomId(u.id)), 0);
    return chanUnread + dmUnread;
  }

  /* ── Send message ────────────────────────────────────────── */
  async function sendMessage(roomId, text) {
    if (!text.trim() || !currentUser) return;
    const isDm = isDM(roomId);
    const msg = {
      id:        'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      room_id:   roomId,
      user_id:   currentUser.id,
      user_name: currentUser.profile?.full_name || currentUser.email.split('@')[0],
      user_email:currentUser.email,
      text:      text.trim(),
      ts:        new Date().toISOString(),
      ...(isDm ? { is_dm: true, to_user: dmOtherId(roomId) } : {}),
    };

    const msgs = loadMessages(roomId);
    msgs.push(msg);
    saveMessages(roomId, msgs);
    renderMessages(roomId);

    // Persist to Supabase activity_logs
    if (window.getDB) {
      try {
        await window.getDB().from('activity_logs').insert({
          user_id:     currentUser.id,
          action:      isDm ? 'team_chat_dm' : 'team_chat',
          entity_type: 'chat',
          entity_id:   null,
          metadata:    {
            room:      roomId,
            text:      text.trim().slice(0,500),
            msg_id:    msg.id,
            user_name: currentUser.profile?.full_name || currentUser.email.split('@')[0],
            ...(isDm ? { to_user: msg.to_user } : {}),
          },
        });
      } catch(e) { /* localStorage is source of truth */ }
    }

    // Broadcast to other tabs
    try { localStorage.setItem('mtx_chat_last', JSON.stringify(msg)); } catch {}
  }

  /* ── Cross-tab sync ──────────────────────────────────────── */
  function initCrossTabSync() {
    window.addEventListener('storage', e => {
      if (e.key === 'mtx_chat_last' && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue);
          if (msg.user_id === currentUser?.id) return;

          // DM: only deliver to the intended recipient
          if (msg.is_dm && msg.to_user !== currentUser?.id) return;

          const msgs = loadMessages(msg.room_id);
          if (!msgs.find(m => m.id === msg.id)) {
            msgs.push(msg);
            saveMessages(msg.room_id, msgs);
          }

          if (msg.room_id === activeRoom && chatOpen) {
            renderMessages(activeRoom);
          } else {
            updateTotalBadge();
            if (msg.is_dm) {
              updateDMUnread(msg.room_id);
            } else {
              const room = ROOMS.find(r=>r.id===msg.room_id);
              const name = room?.name || msg.room_id;
              if (typeof Notiflix !== 'undefined') {
                Notiflix.Notify.info(`💬 ${escH(msg.user_name)} en ${name}: "${escH(msg.text.slice(0,50))}"`);
              }
            }
          }
        } catch {}
      }
    });
  }

  /* ── System messages ─────────────────────────────────────── */
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
        cursor: grab; user-select: none; touch-action: none;
        background: #1C2236; border: 1px solid rgba(0,212,240,.25);
        border-radius: 50%; cursor: pointer; display: flex;
        align-items: center; justify-content: center; font-size: 18px;
        transition: all .15s; box-shadow: 0 4px 14px rgba(0,0,0,.5);
      }
      #tchat-btn:hover { background: rgba(0,212,240,.15); border-color: #00D4F0; transform: scale(1.08); }
      #tchat-btn.has-unread { background: rgba(239,68,68,.18); border-color: #EF4444; box-shadow: 0 4px 18px rgba(239,68,68,.4); animation: tchat-pulse-red 2s ease-in-out infinite; }
      #tchat-btn.has-unread:hover { background: rgba(239,68,68,.3); }
      @keyframes tchat-pulse-red { 0%,100% { box-shadow: 0 4px 18px rgba(239,68,68,.4); } 50% { box-shadow: 0 4px 24px rgba(239,68,68,.7), 0 0 0 4px rgba(239,68,68,.1); } }
      #tchat-btn.dragging { cursor: grabbing; transform: scale(1.05); opacity: .9; }
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
        z-index: 9049; width: 390px; height: 540px;
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
        width: 138px; border-right: 1px solid rgba(255,255,255,.07);
        display: flex; flex-direction: column; background: #0C0F17; overflow-y: auto;
      }
      .tchat-sidebar::-webkit-scrollbar { width: 3px; }
      .tchat-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.06); }

      .tchat-sidebar-section { padding: 8px 10px 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #8BAFC8; }
      .tchat-room {
        display: flex; align-items: center; gap: 5px; padding: 7px 10px;
        font-size: 11px; font-weight: 500; color: #9AAFC0; cursor: pointer;
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

      /* DM list */
      .tchat-dm-user {
        display: flex; align-items: center; gap: 7px; padding: 6px 10px;
        cursor: pointer; transition: all .1s; position: relative;
        font-family: 'Inter', sans-serif;
      }
      .tchat-dm-user:hover { background: rgba(255,255,255,.04); }
      .tchat-dm-user.active { background: rgba(0,255,136,.07); border-left: 2px solid #00FF88; }
      .tchat-dm-avatar {
        width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
        background: linear-gradient(135deg,rgba(0,255,136,.2),rgba(0,212,240,.15));
        border: 1px solid rgba(0,255,136,.25);
        display: flex; align-items: center; justify-content: center;
        font-size: 9px; font-weight: 700; color: #00FF88;
        font-family: 'JetBrains Mono', monospace;
      }
      .tchat-dm-name {
        font-size: 11px; color: #9AAFC0; font-weight: 500;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
      }
      .tchat-dm-user.active .tchat-dm-name { color: #00FF88; font-weight: 700; }
      .tchat-dm-badge {
        background: #EF4444; color: #fff; border-radius: 8px;
        font-size: 9px; font-weight: 700; padding: 0 4px; min-width: 14px; text-align: center;
        font-family: 'JetBrains Mono', monospace; display: none;
      }
      .tchat-dm-badge.show { display: block; }
      #tchat-dm-list-loading { padding: 8px 12px; font-size: 10px; color: #8BAFC8; font-family: 'Inter',sans-serif; }

      .tchat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
      .tchat-room-header { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.07); background: #141922; flex-shrink: 0; }
      .tchat-room-name { font-size: 12px; font-weight: 700; color: #E8EDF8; font-family: 'Inter', sans-serif; }
      .tchat-room-desc { font-size: 10px; color: #9AAFC0; margin-top: 1px; font-family: 'Inter', sans-serif; }

      .dm-privacy-bar {
        display: none; padding: 5px 12px; font-size: 10px;
        background: rgba(0,255,136,.06); border-bottom: 1px solid rgba(0,255,136,.12);
        color: #00FF88; font-family: 'Inter', sans-serif; flex-shrink: 0;
      }
      .dm-privacy-bar.show { display: block; }

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
      .tchat-avatar.dm-av {
        background: linear-gradient(135deg,rgba(0,255,136,.15),rgba(0,212,240,.1));
        border-color: rgba(0,255,136,.2); color: #00FF88;
      }

      .tchat-msg-body { max-width: 76%; }
      .tchat-msg-header { display: flex; gap: 6px; align-items: baseline; margin-bottom: 3px; }
      .tchat-msg-name { font-size: 11px; font-weight: 700; color: #B8C8DC; font-family: 'Inter', sans-serif; }
      .tchat-msg-time { font-size: 9px; color: #8BAFC8; font-family: 'JetBrains Mono', monospace; }
      .tchat-msg.own .tchat-msg-header { flex-direction: row-reverse; }

      .tchat-bubble {
        padding: 7px 11px; border-radius: 10px; font-size: 12px;
        line-height: 1.55; font-family: 'Inter', sans-serif;
        word-break: break-word;
      }
      .tchat-msg:not(.own):not(.system) .tchat-bubble { background: #1C2236; color: #C8D4E8; border-radius: 3px 10px 10px 10px; }
      .tchat-msg.own .tchat-bubble { background: rgba(0,212,240,.12); color: #E8EDF8; border: 1px solid rgba(0,212,240,.2); border-radius: 10px 3px 10px 10px; }
      .tchat-msg.system .tchat-bubble { background: rgba(245,158,11,.08); color: #A06F00; border: 1px solid rgba(245,158,11,.15); font-size: 10px; border-radius: 6px; padding: 4px 10px; }

      /* DM bubbles — green accent */
      .tchat-msg.is-dm:not(.own) .tchat-bubble { background: rgba(0,255,136,.06); border: 1px solid rgba(0,255,136,.1); color: #C8D4E8; border-radius: 3px 10px 10px 10px; }
      .tchat-msg.is-dm.own .tchat-bubble { background: rgba(0,255,136,.1); border: 1px solid rgba(0,255,136,.2); color: #E8EDF8; border-radius: 10px 3px 10px 10px; }

      .tchat-input-area { padding: 8px 10px; border-top: 1px solid rgba(255,255,255,.07); background: #0C0F17; flex-shrink: 0; }
      .tchat-input-row { display: flex; gap: 6px; }
      .tchat-input {
        flex: 1; background: #1C2236; border: 1px solid rgba(255,255,255,.1);
        color: #E8EDF8; border-radius: 6px; padding: 7px 10px;
        font-size: 12px; outline: none; font-family: 'Inter', sans-serif;
        resize: none; min-height: 32px; max-height: 80px;
      }
      .tchat-input:focus { border-color: #00D4F0; }
      .tchat-input.dm-input:focus { border-color: #00FF88; }
      .tchat-input::placeholder { color: #8BAFC8; }
      .tchat-send {
        width: 32px; height: 32px; background: #00D4F0; color: #000;
        border: none; border-radius: 6px; cursor: pointer; font-size: 13px;
        display: flex; align-items: center; justify-content: center;
        transition: background .1s; flex-shrink: 0;
      }
      .tchat-send:hover { background: #19DFFF; }
      .tchat-send.dm-send { background: #00FF88; }
      .tchat-send.dm-send:hover { background: #33FFAA; }
      .tchat-hint { font-size: 9px; color: #8BAFC8; margin-top: 4px; font-family: 'Inter', sans-serif; }

      .tchat-empty { padding: 24px; text-align: center; color: #8BAFC8; font-size: 12px; font-family: 'Inter', sans-serif; }
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
    // click handled by makeDraggable below

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
          <div class="tchat-sidebar-section" style="margin-top:4px">Directos</div>
          <div id="tchat-dm-list">
            <div id="tchat-dm-list-loading">Cargando…</div>
          </div>
        </div>
        <div class="tchat-main">
          <div class="tchat-room-header">
            <div class="tchat-room-name" id="tchat-room-name"># general</div>
            <div class="tchat-room-desc" id="tchat-room-desc">Canal del equipo</div>
          </div>
          <div class="dm-privacy-bar" id="tchat-dm-privacy-bar">🔒 Mensaje privado — solo visible para ti y este usuario</div>
          <div class="tchat-messages" id="tchat-messages">
            <div class="tchat-empty">Cargando mensajes…</div>
          </div>
          <div class="tchat-input-area" id="tchat-input-area">
            <div class="tchat-input-row">
              <textarea class="tchat-input" id="tchat-input" placeholder="Mensaje a #general…" rows="1"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();tchatSend()}"
                oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px'"></textarea>
              <button class="tchat-send" id="tchat-send-btn" onclick="tchatSend()" title="Enviar (Enter)">↑</button>
            </div>
            <div class="tchat-hint">Enter para enviar · Shift+Enter para nueva línea</div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    renderMessages(activeRoom);
    updateAllUnread();
    makeTchatDraggable(btn, panel);
  }

  /* ── Render DM list ─────────────────────────────────────── */
  function renderDMList() {
    const container = document.getElementById('tchat-dm-list');
    if (!container) return;
    if (!users.length) {
      container.innerHTML = '<div id="tchat-dm-list-loading" style="padding:6px 12px;font-size:10px;color:#8BAFC8;font-family:Inter,sans-serif">Sin usuarios</div>';
      return;
    }
    container.innerHTML = users.map(u => {
      const rid     = dmRoomId(u.id);
      const unread  = getUnread(rid);
      const initials= getInitials(u.full_name || u.id);
      const isActive= rid === activeRoom;
      return `
        <div class="tchat-dm-user ${isActive?'active':''}" data-room="${rid}" onclick="tchatSetRoom('${rid}')">
          <div class="tchat-dm-avatar">${escH(initials)}</div>
          <span class="tchat-dm-name">${escH(u.full_name || 'Usuario')}</span>
          <span class="tchat-dm-badge ${unread>0?'show':''}" id="unread-${rid}">${unread||''}</span>
        </div>`;
    }).join('');
  }

  function updateDMUnread(roomId) {
    if (!isDM(roomId)) return;
    const count = getUnread(roomId);
    const el    = document.getElementById(`unread-${roomId}`);
    if (el) { el.textContent = count||''; el.classList.toggle('show', count > 0); }
    updateTotalBadge();
  }

  /* ── Panel control ───────────────────────────────────────── */
  function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('tchat-panel');
    if (panel) panel.classList.toggle('open', chatOpen);
    if (chatOpen) { renderMessages(activeRoom); markRead(activeRoom); syncFromSupabase(activeRoom); }
  }

  window.tchatSetRoom = function(roomId) {
    activeRoom = roomId;
    const dm = isDM(roomId);
    const otherUser = dm ? users.find(u => u.id === dmOtherId(roomId)) : null;

    // Update sidebar active states
    document.querySelectorAll('.tchat-room').forEach(el => el.classList.toggle('active', el.dataset.room === roomId));
    document.querySelectorAll('.tchat-dm-user').forEach(el => el.classList.toggle('active', el.dataset.room === roomId));

    // Update header
    const nameEl = document.getElementById('tchat-room-name');
    const descEl = document.getElementById('tchat-room-desc');
    const privBar= document.getElementById('tchat-dm-privacy-bar');
    const inputEl= document.getElementById('tchat-input');
    const sendBtn= document.getElementById('tchat-send-btn');

    if (dm) {
      const name = otherUser?.full_name || dmOtherId(roomId);
      if (nameEl) nameEl.textContent = '🔒 ' + name;
      if (descEl) descEl.textContent = 'Conversación privada';
      if (privBar) privBar.classList.add('show');
      if (inputEl) { inputEl.placeholder = `Mensaje privado a ${name}…`; inputEl.classList.add('dm-input'); inputEl.classList.remove('ch-input'); }
      if (sendBtn) { sendBtn.classList.add('dm-send'); }
    } else {
      const room = ROOMS.find(r => r.id === roomId);
      if (nameEl && room) nameEl.textContent = room.name;
      if (descEl && room) descEl.textContent = room.desc;
      if (privBar) privBar.classList.remove('show');
      if (inputEl) { inputEl.placeholder = `Mensaje a ${room?.name||roomId}…`; inputEl.classList.remove('dm-input'); }
      if (sendBtn) { sendBtn.classList.remove('dm-send'); }
    }

    // Readonly rooms
    const room = ROOMS.find(r => r.id === roomId);
    const inputArea = document.getElementById('tchat-input-area');
    if (inputArea) inputArea.style.display = (!dm && room?.readonly) ? 'none' : 'block';

    renderMessages(roomId);
    markRead(roomId);
    syncFromSupabase(roomId);
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
    const dm   = isDM(roomId);

    if (!msgs.length) {
      if (dm) {
        const otherUser = users.find(u => u.id === dmOtherId(roomId));
        const name = otherUser?.full_name || 'este usuario';
        container.innerHTML = `<div class="tchat-empty">🔒 Inicio de tu conversación privada con <strong style="color:#00FF88">${escH(name)}</strong>.<br><span style="font-size:10px;color:#8BAFC8;margin-top:4px;display:block">Solo tú y ${escH(name)} pueden ver estos mensajes.</span></div>`;
      } else {
        const room = ROOMS.find(r => r.id === roomId);
        container.innerHTML = `<div class="tchat-empty">${room?.icon||'💬'} Sé el primero en escribir en ${room?.name||roomId}</div>`;
      }
      return;
    }

    container.innerHTML = msgs.map(m => {
      const isMine   = m.user_id === currentUser?.id;
      const isSystem = m.is_system || m.user_id === 'system';
      const initials = getInitials(m.user_name);
      const dmClass  = dm ? 'is-dm' : '';
      if (isSystem) return `<div class="tchat-msg system"><div class="tchat-bubble">${escH(m.text)}</div></div>`;
      return `
        <div class="tchat-msg ${isMine?'own':''} ${dmClass}">
          ${!isMine ? `<div class="tchat-avatar ${dm?'dm-av':''}">${escH(initials)}</div>` : ''}
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
    users.forEach(u => {
      const rid   = dmRoomId(u.id);
      const count = getUnread(rid);
      const el    = document.getElementById(`unread-${rid}`);
      if (el) { el.textContent = count||''; el.classList.toggle('show', count > 0); }
    });
    updateTotalBadge();
  }

  function updateTotalBadge() {
    const total = getTotalUnread();
    const badge = document.getElementById('tchat-badge');
    const btn   = document.getElementById('tchat-btn');
    if (badge) { badge.textContent = total || ''; badge.classList.toggle('show', total > 0); }
    if (btn)   { btn.classList.toggle('has-unread', total > 0); }
  }

  /* ── System events ───────────────────────────────────────── */
  function listenForSystemEvents() {
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
    const waitForUser = () => new Promise(async (resolve) => {
      // 1. Already available synchronously
      if (window._mtxCurrentUser) return resolve(window._mtxCurrentUser);

      // 2. Try getCurrentUser() directly (set by app.js before teamchat loads)
      if (typeof window.getCurrentUser === 'function') {
        try {
          const u = await window.getCurrentUser();
          if (u) { window._mtxCurrentUser = window._mtxCurrentUser || u; return resolve(u); }
        } catch(_) {}
      }

      // 3. Poll with hard timeout — max 20 attempts × 500ms = 10 seconds
      let attempts = 0;
      const check = async () => {
        attempts++;
        if (window._mtxCurrentUser) return resolve(window._mtxCurrentUser);

        if (attempts >= 20) {
          // 4. Last resort: read session directly from Supabase
          if (window.getDB) {
            try {
              const { data: { session } } = await window.getDB().auth.getSession();
              if (session?.user) {
                const { data: prof } = await window.getDB()
                  .from('profiles').select('*').eq('id', session.user.id).single();
                const u = { ...session.user, profile: prof || {} };
                window._mtxCurrentUser = u;
                return resolve(u);
              }
            } catch(_) {}
          }
          return resolve(null); // give up — never hang forever
        }
        setTimeout(check, 500);
      };
      check();
    });
    currentUser = await waitForUser();
    if (!currentUser) return; // no auth — exit gracefully, don't hang

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

    // Load users for DMs (async, no blocking)
    loadUsers();

    // Periodic unread check + user refresh every 2 min
    setInterval(updateAllUnread, 30000);
    setInterval(loadUsers, 120000);
  }

  /* ── Draggable TeamChat button ──────────────────────────── */
  function makeTchatDraggable(btn, panel) {
    const THRESH = 4, POS_KEY = 'mtx_tchat_pos';

    function anchorTopLeft() {
      const r = btn.getBoundingClientRect();
      btn.style.bottom = 'auto'; btn.style.right = 'auto';
      btn.style.top  = clampY(r.top)  + 'px';
      btn.style.left = clampX(r.left) + 'px';
    }

    function repositionPanel() {
      if (!panel) return;
      const br = btn.getBoundingClientRect();
      const pw = panel.offsetWidth  || 390;
      const ph = panel.offsetHeight || 540;
      const gap = 10;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = br.right + gap;
      if (left + pw > vw - 8) left = br.left - pw - gap;
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
      anchorTopLeft();
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
      if (chatOpen) repositionPanel();
      e.preventDefault();
    });

    btn.addEventListener('pointerup', () => {
      if (!active) return;
      active = false;
      btn.classList.remove('dragging');
      if (moved) {
        try { localStorage.setItem(POS_KEY, JSON.stringify({top: parseFloat(btn.style.top), left: parseFloat(btn.style.left)})); } catch(_) {}
      } else {
        toggleChat();
      }
    });

    btn.addEventListener('pointercancel', () => { active = false; btn.classList.remove('dragging'); });

    function clampX(x) { return Math.max(0, Math.min(window.innerWidth  - (btn.offsetWidth  || 44), x)); }
    function clampY(y) { return Math.max(0, Math.min(window.innerHeight - (btn.offsetHeight || 44), y)); }
  }

  window.teamChat = { sendMessage, injectSystemMessage };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
