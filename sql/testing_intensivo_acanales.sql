-- ============================================================
-- TESTING INTENSIVO — Datos de prueba para acanales@ibanormexico.com
-- Steve Jobs / Elon Musk / Alex Karp Level Testing
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. LEADS DE PRUEBA (8 leads en diferentes etapas) ────────

-- Primero: obtener el user_id de acanales
-- SELECT id FROM profiles WHERE email = 'acanales@ibanormexico.com';
-- Reemplaza 'ACANALES_USER_ID' con el UUID real

DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM profiles WHERE email = 'acanales@ibanormexico.com';

  IF uid IS NULL THEN
    RAISE NOTICE 'Usuario acanales@ibanormexico.com no encontrado';
    RETURN;
  END IF;

  -- Lead 1: FEMSA Retail — en negociación (hot)
  INSERT INTO leads (user_id, empresa, contacto_nombre, cargo, contacto_email,
    contacto_telefono, status, fuente, campana, valor_estimado, moneda,
    seguimiento, notas, updated_at)
  VALUES (uid, 'FEMSA Retail OXXO', 'Lic. Carmen Villanueva', 'VP de Tecnología',
    'c.villanueva@femsa.com', '+52 81 8888 1234', 'en_negociacion',
    'linkedin', 'Q2 Retail LATAM 2026', 4500000, 'MXN',
    CURRENT_DATE + 2,
    'FEMSA evalúa Metaview Systems para 3,500 tiendas OXXO en México. Reducción esperada de shrinkage 65%. Demo realizada 8-Abr con resultado muy positivo. Decisión final la próxima semana. Deal más grande del pipeline.',
    NOW() - INTERVAL '1 day')
  ON CONFLICT DO NOTHING;

  -- Lead 2: Banorte — propuesta enviada
  INSERT INTO leads (user_id, empresa, contacto_nombre, cargo, contacto_email,
    contacto_telefono, status, fuente, campana, valor_estimado, moneda,
    seguimiento, notas, updated_at)
  VALUES (uid, 'Grupo Financiero Banorte', 'Dr. Luis Ramírez', 'Chief Data Officer',
    'l.ramirez@banorte.com', '+52 55 5268 1600', 'propuesta_enviada',
    'evento', 'FinTech Mexico Summit 2026', 7200000, 'MXN',
    CURRENT_DATE + 5,
    'Banorte necesita QuantumTron para detección de fraude en tiempo real. 12M transacciones/día. Propuesta enviada el 5-Abr. Revisión con equipo técnico esta semana. Presupuesto Q2 confirmado.',
    NOW() - INTERVAL '3 days')
  ON CONFLICT DO NOTHING;

  -- Lead 3: Tec de Monterrey — calificación
  INSERT INTO leads (user_id, empresa, contacto_nombre, cargo, contacto_email,
    contacto_telefono, status, fuente, campana, valor_estimado, moneda,
    seguimiento, notas, updated_at)
  VALUES (uid, 'Tecnológico de Monterrey', 'Mtra. Sofía Morales', 'Directora Académica Digital',
    's.morales@tec.mx', '+52 81 8358 2000', 'contactado',
    'referido', 'Educación IA LATAM 2026', 3100000, 'MXN',
    CURRENT_DATE + 4,
    'Referido por EduCorp. Tec busca implementar Aria New Gen para 95,000 estudiantes. Primera llamada muy positiva. Quiere demo con Rector. Semestre agosto sería ideal para implementación.',
    NOW() - INTERVAL '2 days')
  ON CONFLICT DO NOTHING;

  -- Lead 4: Liverpool — primer contacto
  INSERT INTO leads (user_id, empresa, contacto_nombre, cargo, contacto_email,
    contacto_telefono, status, fuente, campana, valor_estimado, moneda,
    seguimiento, notas, updated_at)
  VALUES (uid, 'Liverpool Corporativo', 'Ing. Marco González', 'Director de Operaciones',
    'm.gonzalez@liverpool.com.mx', '+52 55 1234 5678', 'contactado',
    'linkedin', 'Q2 Retail LATAM 2026', 3800000, 'MXN',
    CURRENT_DATE + 6,
    'Liverpool evalúa Metaview Systems para sus 135 tiendas. Pain: 2.1M MXN en shrinkage anual. Primer contacto LinkedIn muy receptivo. Agendar demo la próxima semana con equipo TI.',
    NOW() - INTERVAL '5 days')
  ON CONFLICT DO NOTHING;

  -- Lead 5: Clip — nuevo (frío)
  INSERT INTO leads (user_id, empresa, contacto_nombre, cargo, contacto_email,
    contacto_telefono, status, fuente, campana, valor_estimado, moneda,
    seguimiento, notas, updated_at)
  VALUES (uid, 'Clip México', 'Arq. Daniela Torres', 'Head of Product',
    'd.torres@clip.mx', '+52 55 8765 4321', 'nuevo',
    'web', 'FinTech Mexico Summit 2026', 2400000, 'MXN',
    CURRENT_DATE + 10,
    'Clip llenó formulario web interesado en NeuroTron Lab para onboarding de comercios. 3.5M comercios activos. Prospecto caliente — contactar en las próximas 24h.',
    NOW() - INTERVAL '6 hours')
  ON CONFLICT DO NOTHING;

  -- Lead 6: Bimbo — cierre próximo
  INSERT INTO leads (user_id, empresa, contacto_nombre, cargo, contacto_email,
    contacto_telefono, status, fuente, campana, valor_estimado, moneda,
    seguimiento, notas, updated_at)
  VALUES (uid, 'Grupo Bimbo', 'Lic. Roberto Salinas', 'VP de Transformación Digital',
    'r.salinas@grupobimbo.com', '+52 55 1234 9876', 'en_negociacion',
    'referido', 'Enterprise LATAM 2026', 9800000, 'MXN',
    CURRENT_DATE + 1,
    'DEAL MÁS GRANDE. Bimbo necesita QuantumTron para supply chain y NeuroTron Lab para agentes de ventas autónomos. 128 países, 197 plantas. Contrato marco global. Cierre esta semana.',
    NOW() - INTERVAL '12 hours')
  ON CONFLICT DO NOTHING;

  -- Lead 7: Walmart México — ganado (postventa)
  INSERT INTO leads (user_id, empresa, contacto_nombre, cargo, contacto_email,
    contacto_telefono, status, fuente, campana, valor_estimado, moneda,
    seguimiento, notas, updated_at)
  VALUES (uid, 'Walmart de México', 'Ing. Patricia Vega', 'CTO',
    'p.vega@walmart.com.mx', '+52 55 5283 0000', 'cerrado_ganado',
    'evento', 'Retail AI Summit 2025', 5500000, 'MXN',
    CURRENT_DATE + 30,
    'CERRADO. Implementación Metaview Systems en 2,500 tiendas. Fase 1 completada (500 tiendas). Resultados: shrinkage -71%, ROI en 7 meses. Cliente referencia MetaTronix.',
    NOW() - INTERVAL '30 days')
  ON CONFLICT DO NOTHING;

  -- Lead 8: IMSS — perdido
  INSERT INTO leads (user_id, empresa, contacto_nombre, cargo, contacto_email,
    contacto_telefono, status, fuente, campana, valor_estimado, moneda,
    seguimiento, notas, updated_at)
  VALUES (uid, 'IMSS — Gobierno México', 'Dr. Fernando Cruz', 'Subdirector de TI',
    'f.cruz@imss.gob.mx', '+52 55 5229 0000', 'cerrado_perdido',
    'llamada', 'Gobierno Digital 2025', 12000000, 'MXN',
    NULL,
    'Perdido. Proceso de licitación pública — 18 meses. Ganó competidor con precio más bajo. Reto: proceso burocrático del gobierno incompatible con nuestro modelo de venta. Lesson learned: gobierno requiere licitación previa.',
    NOW() - INTERVAL '60 days')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Leads de prueba creados para % (UID: %)', 'acanales@ibanormexico.com', uid;
END $$;

-- ── 2. VERIFICACIÓN ────────────────────────────────────────
SELECT
  l.empresa,
  l.contacto_nombre,
  l.status,
  l.valor_estimado,
  l.seguimiento,
  l.fuente,
  CASE l.status
    WHEN 'nuevo' THEN '🌱 Nuevo'
    WHEN 'contactado' THEN '📞 Contactado'
    WHEN 'en_negociacion' THEN '🤝 Negociación'
    WHEN 'propuesta_enviada' THEN '📋 Propuesta'
    WHEN 'cerrado_ganado' THEN '🏆 Ganado'
    WHEN 'cerrado_perdido' THEN '❌ Perdido'
  END AS etapa_display
FROM leads l
JOIN profiles p ON p.id = l.user_id
WHERE p.email = 'acanales@ibanormexico.com'
ORDER BY l.updated_at DESC;

-- ── 3. ESTADÍSTICAS DEL PIPELINE ──────────────────────────
SELECT
  COUNT(*) AS total_leads,
  SUM(CASE WHEN status NOT IN ('cerrado_perdido','cerrado_ganado') THEN valor_estimado ELSE 0 END) AS pipeline_activo,
  SUM(CASE WHEN status = 'cerrado_ganado' THEN valor_estimado ELSE 0 END) AS ganado_total,
  COUNT(CASE WHEN status = 'cerrado_ganado' THEN 1 END) AS deals_ganados,
  ROUND(COUNT(CASE WHEN status = 'cerrado_ganado' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS win_rate_pct
FROM leads l
JOIN profiles p ON p.id = l.user_id
WHERE p.email = 'acanales@ibanormexico.com';
