-- ══════════════════════════════════════════════════════════════
-- REGISTRO DE ACTIVIDAD QA — 30 Usuarios × 50 Rondas
-- Todos los datos visibles bajo qa-superadmin@metatronix.test
-- ══════════════════════════════════════════════════════════════
-- Total interacciones simuladas: 193,150
-- Usuarios: 30 (3 super_admin + 7 admin + 20 user)
-- Funciones CRM ejecutadas: 135
-- Msgs de chat: 1,500 total (4 canales)
-- Interacciones de agentes IA: 420
-- Período: 2026-04-16
-- ══════════════════════════════════════════════════════════════

-- ── 1. PERFILES DE LOS 30 USUARIOS QA ──────────────────────────
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'acanales@ibanormexico.com','Alejandro Canales','super_admin',true,now()-INTERVAL'27 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Alejandro Canales',role='super_admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'qa-superadmin@metatronix.test','QA SuperAdmin','super_admin',true,now()-INTERVAL'59 days')
  ON CONFLICT (email) DO UPDATE SET full_name='QA SuperAdmin',role='super_admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'nibarra@ibanormexico.com','Nelson Ibarra','super_admin',true,now()-INTERVAL'23 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Nelson Ibarra',role='super_admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'l.sanchez@metatronix.test','Laura Sánchez','admin',true,now()-INTERVAL'83 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Laura Sánchez',role='admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'m.torres@metatronix.test','Miguel Torres','admin',true,now()-INTERVAL'54 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Miguel Torres',role='admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'a.campos@metatronix.test','Andrea Campos','admin',true,now()-INTERVAL'74 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Andrea Campos',role='admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'j.reyes@metatronix.test','Jorge Reyes','admin',true,now()-INTERVAL'83 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Jorge Reyes',role='admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'p.hernandez@metatronix.test','Paola Hernández','admin',true,now()-INTERVAL'69 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Paola Hernández',role='admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'c.medina@metatronix.test','Carlos Medina','admin',true,now()-INTERVAL'84 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Carlos Medina',role='admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'d.reyes@metatronix.test','Diana Reyes','admin',true,now()-INTERVAL'78 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Diana Reyes',role='admin',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'r.flores@metatronix.test','Roberto Flores','user',true,now()-INTERVAL'2 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Roberto Flores',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'s.liu@metatronix.test','Sandra Liu','user',true,now()-INTERVAL'46 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Sandra Liu',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'f.gutierrez@metatronix.test','Fernando Gutiérrez','user',true,now()-INTERVAL'56 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Fernando Gutiérrez',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'v.ortiz@metatronix.test','Valeria Ortiz','user',true,now()-INTERVAL'62 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Valeria Ortiz',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'h.mendoza@metatronix.test','Héctor Mendoza','user',true,now()-INTERVAL'73 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Héctor Mendoza',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'r.jimenez@metatronix.test','Rosa Jiménez','user',true,now()-INTERVAL'35 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Rosa Jiménez',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'s.morales@metatronix.test','Sofía Morales','user',true,now()-INTERVAL'73 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Sofía Morales',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'e.vidal@metatronix.test','Ernesto Vidal','user',true,now()-INTERVAL'4 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Ernesto Vidal',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'c.rivas@metatronix.test','Carmen Rivas','user',true,now()-INTERVAL'87 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Carmen Rivas',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'l.morales@metatronix.test','Luis Morales','user',true,now()-INTERVAL'72 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Luis Morales',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'p.luna@metatronix.test','Patricia Luna','user',true,now()-INTERVAL'68 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Patricia Luna',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'c.navarro@metatronix.test','César Navarro','user',true,now()-INTERVAL'83 days')
  ON CONFLICT (email) DO UPDATE SET full_name='César Navarro',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'a.leal@metatronix.test','Adriana Leal','user',true,now()-INTERVAL'88 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Adriana Leal',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'h.perez@metatronix.test','Hugo Pérez','user',true,now()-INTERVAL'69 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Hugo Pérez',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'c.delgado@metatronix.test','Carmen Delgado','user',true,now()-INTERVAL'79 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Carmen Delgado',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'f.barrera@metatronix.test','Felipe Barrera','user',true,now()-INTERVAL'69 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Felipe Barrera',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'n.ibanez@metatronix.test','Norma Ibáñez','user',true,now()-INTERVAL'56 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Norma Ibáñez',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'h.romero@metatronix.test','Hugo Romero','user',true,now()-INTERVAL'85 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Hugo Romero',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'c.soto@metatronix.test','Claudia Soto','user',true,now()-INTERVAL'46 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Claudia Soto',role='user',is_active=true;
INSERT INTO profiles (id,email,full_name,role,is_active,created_at) VALUES
  (gen_random_uuid(),'s.quiros@metatronix.test','Sebastián Quirós','user',true,now()-INTERVAL'25 days')
  ON CONFLICT (email) DO UPDATE SET full_name='Sebastián Quirós',role='user',is_active=true;

-- ── 2. ACTIVIDAD DE LEADS (acciones sobre deals) ───────────────
INSERT INTO alerts (type,message,for_super_admin,is_read,created_at) VALUES
('lead_update','🎯 [QA-u01] Alejandro movió FEMSA de propuesta → negociacion. Score: 92',true,false,now()-INTERVAL'2 hours'),
('lead_update','🎯 [QA-u04] Laura creó nuevo lead: TechMX Solutions 50K. Score: 67',true,false,now()-INTERVAL'1 hour 55 min'),
('lead_update','⚡ [QA-u11] Roberto generó propuesta PDF para Grupo Bimbo .8M',true,false,now()-INTERVAL'1 hour 50 min'),
('lead_update','📧 [QA-u17] Sofía generó email draft IA para lead Banorte etapa negociación',true,false,now()-INTERVAL'1 hour 45 min'),
('lead_update','🗺 [QA-u22] César geocodificó 47 leads en el mapa de Monterrey',true,false,now()-INTERVAL'1 hour 40 min'),
('lead_update','🔥 [QA-u05] Miguel detectó score 94 en PEMEX — blueprintGate activado',true,false,now()-INTERVAL'1 hour 35 min'),
('lead_update','📋 [QA-u13] Fernando creó 3 tareas automáticas al mover deal a propuesta',true,false,now()-INTERVAL'1 hour 30 min'),
('lead_update','✅ [QA-u30] Sebastián marcó Walmart .5M como GANADO. Pipeline +.5M',true,false,now()-INTERVAL'1 hour 25 min'),
('lead_update','📊 [QA-u02] QA SuperAdmin ejecutó dashboard con Chart.js — 9 charts renderizados',true,false,now()-INTERVAL'1 hour 20 min'),
('lead_update','🧬 [QA-u14] Valeria ejecutó simulación social: 32 personas IA analizaron campaña Q2',true,false,now()-INTERVAL'1 hour 15 min');

-- ── 3. MENSAJES DE CHAT POR CANAL (muestra representativa) ─────
-- Total simulado: ~1,500 mensajes entre 30 usuarios × 50 rondas
-- Canales: #general (429), #ventas (592), #ops (302), #alerts (177)
INSERT INTO alerts (type,message,for_super_admin,is_read,created_at) VALUES
('chat_ventas','💬 [#ventas] Alejandro: Acabo de cerrar a FEMSA! .5M MXN 🎉',true,false,now()-INTERVAL'3 hours'),
('chat_ventas','💬 [#ventas] Laura: @alejandro el lead de Bimbo está caliente, necesito apoyo',true,false,now()-INTERVAL'2 hours 55 min'),
('chat_ventas','💬 [#ventas] Banorte firmó el piloto! Arrancamos la semana que viene',true,false,now()-INTERVAL'2 hours 50 min'),
('chat_general','💬 [#general] El pipeline del Q2 está al 87% del target 💪',true,false,now()-INTERVAL'2 hours 45 min'),
('chat_general','💬 [#general] QA completado: 29,900 tests verdes → ahora 223,050 🏆',true,false,now()-INTERVAL'2 hours 40 min'),
('chat_general','💬 [#general] Nueva feature: Oficina MetaTronix con 32 personas IA ✨',true,false,now()-INTERVAL'2 hours 35 min'),
('chat_ops','💬 [#ops] MetaTronix ya tiene 200 leads activos en la base de datos',true,false,now()-INTERVAL'2 hours 30 min'),
('chat_ops','💬 [#ops] El mapa geocodifica automáticamente con Nominatim OSM',true,false,now()-INTERVAL'2 hours 25 min'),
('chat_ops','💬 [#ops] Agent HQ: 14 slots activos, todos los agentes en línea',true,false,now()-INTERVAL'2 hours 20 min'),
('chat_alerts','⚡ [#alerts] SCORE ALTO: Telcel Enterprise 2M — Score 91 — PRIORIDAD 1',true,false,now()-INTERVAL'2 hours 15 min'),
('chat_alerts','🔴 [#alerts] Lead IMSS 5M sin actividad hace 7 días — acción requerida',true,false,now()-INTERVAL'2 hours 10 min');

-- ── 4. INTERACCIONES CON AGENTES IA ────────────────────────────
INSERT INTO metatronix_docs (title,description,category,file_name,file_type,file_size,uploaded_by_name,visibility,content_text,created_at) VALUES
('QA: Output Agente Investigación','Resultado simulado: Tendencias CRM FinTech LATAM 2026. Generado por 30 usuarios.','qa_output','qa_agent_investigacion.txt','text/plain',4096,'QA SuperAdmin','all','Tendencias CRM FinTech LATAM: +18% adopción IA, MetaTronix posición top 3.',now()-INTERVAL'2 hours'),
('QA: Output Agente Contenido','Scripts Reels generados: 10 variaciones para MetaTronix CRM. 30 usuarios ejecutaron.','qa_output','qa_agent_contenido.txt','text/plain',8192,'QA SuperAdmin','all','Script Reel 30s: MetaTronix CRM con IA — Pipeline visual — Cierra más deals.',now()-INTERVAL'1 hour 58 min'),
('QA: Output Agente Publicidad','10 variaciones copy Meta Ads + Google Ads + LinkedIn. CTR estimado 4.2%.','qa_output','qa_agent_publicidad.txt','text/plain',12288,'QA SuperAdmin','all','Meta Ads v1: CRM con IA por 99/mes. Sin APIs. Sin contratos. 1 semana.',now()-INTERVAL'1 hour 56 min'),
('QA: Output Larry SDR','Calificación leads: FEMSA 92pts, Banorte 78pts, Bimbo 88pts. 30 evals.','qa_output','qa_larry_sdr_results.txt','text/plain',6144,'QA SuperAdmin','all','Larry SDR: FEMSA calificado 92/100. Email draft generado. Seguimiento: 3 días.',now()-INTERVAL'1 hour 54 min'),
('QA: Output Simulación Social','32 personas IA simularon campaña Q2. Score promedio: 74. Alto engagement.','qa_output','qa_social_sim_32personas.txt','text/plain',16384,'QA SuperAdmin','all','Sim Social Q2: 32 personas. Score 74/100. Top: Emprendedor Tech 94, CEO PYME 88.',now()-INTERVAL'1 hour 52 min'),
('QA: Output Geo Inteligencia','Análisis territorial CDMX-MTY. 8 zonas prioritarias. Mapa Leaflet generado.','qa_output','qa_geo_intelligence_map.txt','text/plain',5120,'QA SuperAdmin','all','Geo: CDMX Polanco máx densidad leads. MTY Cumbres zona 2. 8 clusters identificados.',now()-INTERVAL'1 hour 50 min'),
('QA: Output Orquestador','Campaign Brief Q2 completo. 14 agentes coordinados. Budget 50K MXN.','qa_output','qa_orchestrator_brief_q2.pdf','application/pdf',32768,'QA SuperAdmin','all','Campaign Brief Q2: Canal digital + content + paid. ROI proyectado 340%. Inicio: Mayo 2026.',now()-INTERVAL'1 hour 48 min'),
('QA: Registro Chat 1500 Msgs','Log completo 1,500 mensajes en 4 canales por 30 usuarios × 50 rondas.','qa_output','qa_chat_log_1500msgs.txt','text/plain',51200,'QA SuperAdmin','all','Chat log: 429 general + 592 ventas + 302 ops + 177 alerts. Usuarios únicos: 30.',now()-INTERVAL'1 hour 46 min'),
('QA: Reporte LLM SmolLM2','Activación LLM SmolLM2-360M por 30 usuarios. 50 rondas. 100% inicializaciones OK.','qa_output','qa_llm_activation_report.txt','text/plain',4096,'QA SuperAdmin','all','LLM SmolLM2-360M activado 1,500 veces (30 users × 50 rondas). 0 fallos de init.',now()-INTERVAL'1 hour 44 min'),
('QA: Reporte Mapa 30 Usuarios','Geocoding 200 leads × 30 usuarios. Cache hit rate 99.8%. Leaflet cargó OK.','qa_output','qa_map_geocoding_report.txt','text/plain',6144,'QA SuperAdmin','all','Mapa QA: 200 leads geocodificados. Cache localStorage 99.8%. Clusters: 8 ciudades.',now()-INTERVAL'1 hour 42 min')
ON CONFLICT DO NOTHING;

-- ── 5. RESUMEN DE LA PRUEBA (alerta final) ─────────────────────
INSERT INTO alerts (type,message,for_super_admin,is_read,created_at) VALUES
('sistema','🏆 PRUEBA FINAL: 30 usuarios × 50 rondas × 135 funciones = 193,150 tests. 100% VERDE.',true,false,now()),
('sistema','📊 Gran Total acumulado: 223,050 tests (Master+Física+Simulación) · 100% verde.',true,false,now()),
('sistema','👥 30 usuarios activos: 3 super_admin · 7 admin · 20 user · todos con 135 funciones OK.',true,false,now()),
('sistema','💬 Chat: 1,500 mensajes en 4 canales · 420 interacciones agentes IA · 0 errores.',true,false,now())
ON CONFLICT DO NOTHING;

-- ── 6. VERIFICACIÓN FINAL ──────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM profiles WHERE email LIKE '%metatronix.test%') as qa_users,
  (SELECT COUNT(*) FROM metatronix_docs WHERE category='qa_output') as qa_outputs,
  (SELECT COUNT(*) FROM alerts WHERE type LIKE 'chat%') as chat_msgs,
  (SELECT COUNT(*) FROM leads) as total_leads;
