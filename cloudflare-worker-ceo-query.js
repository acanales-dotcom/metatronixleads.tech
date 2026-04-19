// ═══════════════════════════════════════════════════════════════════════════
// CLOUDFLARE WORKER — Ruta /ceo-query
// CEO Nerve Center · Router de Inteligencia Organizacional
//
// INSTRUCCIONES DE INTEGRACIÓN:
// 1. Abre el Worker en https://dash.cloudflare.com → Workers → tu-worker
// 2. Copia la función handleCeoQuery de este archivo
// 3. En el fetch handler existente, agrega ANTES del catch general:
//
//      if (url.pathname === '/ceo-query') {
//        return handleCeoQuery(request, corsHeaders);
//      }
//
// 4. Copia la función handleCeoQuery al final del archivo.
// ═══════════════════════════════════════════════════════════════════════════

// ── AÑADIR EN EL FETCH HANDLER ───────────────────────────────────────────
/*
  if (url.pathname === '/ceo-query') {
    return handleCeoQuery(request, corsHeaders);
  }
*/

// ── FUNCIÓN COMPLETA ─────────────────────────────────────────────────────
async function handleCeoQuery(request, corsHeaders) {
  // Solo POST
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ── Verificar JWT ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Verificar rol CEO (admin/super_admin) via Supabase
  let userProfile = null;
  try {
    const profileResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,role,full_name,company_id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    const profiles = await profileResp.json();
    userProfile = profiles?.[0];
  } catch (e) {
    console.error('Profile fetch error:', e);
  }

  if (!userProfile || !['admin', 'super_admin'].includes(userProfile.role)) {
    return new Response(JSON.stringify({ error: 'Acceso restringido a CEO / Admin' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ── Parsear body ─────────────────────────────────────────────────────────
  let body;
  try { body = await request.json(); }
  catch (e) {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { question, pulse, query_type = 'ad_hoc' } = body;

  if (!question || question.trim().length < 3) {
    return new Response(JSON.stringify({ error: 'La pregunta está vacía' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ── Construir contexto organizacional desde el pulse snapshot ─────────────
  const p = pulse || {};
  const fmt = (n) => {
    const v = parseFloat(n) || 0;
    return v >= 1e6 ? '$' + (v/1e6).toFixed(1) + 'M'
         : v >= 1e3 ? '$' + (v/1e3).toFixed(0) + 'K'
         : '$' + v.toFixed(0);
  };

  const orgContext = `
═══════════════════════════════════════════════════════
ESTADO ACTUAL DE LA ORGANIZACIÓN — IBANOR SA de CV / MetaTronix
Fecha snapshot: ${p.captured_at ? new Date(p.captured_at).toLocaleString('es-MX') : new Date().toLocaleString('es-MX')}
Score de Salud Org: ${p.org_health_score ?? 'Sin dato'}/100
═══════════════════════════════════════════════════════

VENTAS & COMERCIAL:
• Pipeline total activo: ${fmt(p.pipeline_total)}
• Deals activos: ${p.deals_activos ?? 'Sin dato'}
• Deals ganados este mes: ${p.deals_ganados_mes ?? 'Sin dato'}
• Deals en riesgo: ${p.deals_en_riesgo ?? 'Sin dato'}
• Leads nuevos (7 días): ${p.leads_nuevos_7d ?? 'Sin dato'}
• Tasa de conversión (30d): ${p.conversion_rate ?? 'Sin dato'}%

FINANZAS & TESORERÍA:
• CXC total pendiente: ${fmt(p.cxc_total)}
• CXC vencida: ${fmt(p.cxc_vencida)} (${p.cxc_total > 0 ? ((p.cxc_vencida/p.cxc_total)*100).toFixed(1) : 0}% del total)
• CXP total: ${fmt(p.cxp_total)}
• CXP próximos 30 días: ${fmt(p.cxp_proximos_30d)}
• Flujo neto (CXC-CXP): ${fmt(p.flujo_neto)}
• Facturas urgentes (>60d): ${p.cobranza_urgente ?? 'Sin dato'}

COMPRAS & OPERACIONES:
• Órdenes de compra pendientes: ${p.oc_pendientes ?? 'Sin dato'} (${fmt(p.oc_monto_pendiente)})
• Requisiciones abiertas: ${p.requisiciones_abiertas ?? 'Sin dato'}

PLATAFORMA & ADOPCIÓN IA:
• Usuarios activos: ${p.usuarios_activos ?? 'Sin dato'}
• Consultas IA últimas 24h: ${p.ai_queries_24h ?? 'Sin dato'}
• Consultas IA últimos 7d: ${p.ai_queries_7d ?? 'Sin dato'}
═══════════════════════════════════════════════════════`;

  // ── Detectar dominio(s) de la pregunta ──────────────────────────────────
  const q = question.toLowerCase();
  const domains = [];
  if (/venta|pipeline|deal|lead|cliente|conversion|cerrar|quota/.test(q)) domains.push('ventas');
  if (/marketing|campa[ñn]|growth|lead.*gen|posicion/.test(q)) domains.push('marketing');
  if (/cxc|cobr|factura|vencid|pago|flujo|tesorero|cash|cxp|finanzas|fiscal|sat/.test(q)) domains.push('finanzas');
  if (/compra|oc|orden.*compra|proveedor|requisici/.test(q)) domains.push('compras');
  if (/operaci|proceso|eficiencia|kpi|equipo|recurso|productiv/.test(q)) domains.push('operaciones');
  if (/riesgo|alerta|problema|crisis|urgente|critico|peligro/.test(q)) domains.push('riesgo');
  if (domains.length === 0) domains.push('general');

  // ── System prompt del CEO Query Router ──────────────────────────────────
  const systemPrompt = `Eres el Consejero Ejecutivo IA de IBANOR SA de CV / MetaTronix.
Tu única función es responder preguntas organizacionales al CEO con DATOS REALES del sistema.
Dominio de la pregunta detectado: ${domains.join(', ')}.

PROTOCOLO ANTI-ALUCINACIÓN NIVEL EJECUTIVO — REGLAS NO NEGOCIABLES:
1. SOLO usa los datos del contexto organizacional provisto. NUNCA inventes cifras adicionales.
2. Cuando cites un número, indica su origen: "(Fuente: Ventas/Pipeline)", "(Fuente: CXC vencida)", etc.
3. HECHO vs ANÁLISIS: distingue claramente qué es dato real ("el sistema registra X") vs interpretación ("esto sugiere Y").
4. Si el dato que necesitas no está en el contexto, escribe explícitamente: "Sin dato disponible en el sistema — requiere verificación manual".
5. CAUSALIDAD: no atribuyas causas sin evidencia directa. Escribe "correlación posible".
6. RECOMENDACIONES: termina con "⚠ Validar con datos actualizados antes de tomar acción".
7. DATOS FINANCIEROS: añade "† Basado en snapshot de ${new Date().toLocaleDateString('es-MX')} — auditar antes de decisiones ejecutivas".

FORMATO: Responde en HTML semántico limpio (h2, h3, p, ul, strong, table).
Sin DOCTYPE, html, head, body. Directo al contenido.
Máximo 500 palabras. Ejecutivo, concreto, sin rodeos.`;

  // ── Construir prompt final ────────────────────────────────────────────────
  const userPrompt = `${orgContext}

PREGUNTA DEL CEO:
"${question}"

Responde con base EXCLUSIVA en los datos del contexto anterior.
Estructura tu respuesta con:
<h2>[ícono relevante] [Respuesta directa en 5 palabras]</h2>
<h3>Datos relevantes</h3>
[cifras del sistema, citando fuente]
<h3>Análisis ejecutivo</h3>
[interpretación basada en los datos]
<h3>Acción recomendada</h3>
[1-3 acciones concretas con ⚠ al final]`;

  // ── Llamar a Claude claude-sonnet-4-6 con streaming ───────────────────────────────────────
  let claudeResp;
  try {
    claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error conectando con Claude: ' + e.message }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!claudeResp.ok) {
    const errTxt = await claudeResp.text();
    return new Response(JSON.stringify({ error: 'Claude API error ' + claudeResp.status + ': ' + errTxt }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ── Traducir streaming Anthropic → SSE para el browser ──────────────────
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = claudeResp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const chunk = JSON.stringify({
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: parsed.delta.text }
              });
              await writer.write(encoder.encode(`data: ${chunk}\n\n`));
            }
          } catch (_) {}
        }
      }
      // Mandar metadata de dominios al final
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'meta', domains, query_type })}\n\n`));
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (e) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    }
  });
}

// ── NOTA: Las variables ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
//    ya deben existir como environment variables del Worker.
//    Si usas la estructura del Worker original de MetaTronix, ya están definidas. ──
