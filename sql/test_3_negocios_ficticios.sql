-- ============================================================
-- PRUEBA E2E: 3 Negocios Ficticios Completos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Simula el ciclo completo: generación → cierre → postventa
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- NEGOCIO 1: RetailMax México
-- Vertical: Retail | Producto: Metaview Systems
-- Etapa: Negociación (deal caliente)
-- ════════════════════════════════════════════════════════════
INSERT INTO leads (
  empresa, contacto_nombre, cargo, contacto_email, contacto_telefono,
  status, fuente, campana, valor_estimado, moneda,
  seguimiento, notas, updated_at
) VALUES (
  'RetailMax México SA de CV',
  'Lic. Patricia Vargas',
  'Directora de Operaciones',
  'p.vargas@retailmax.com.mx',
  '+52 55 4521 8900',
  'en_negociacion',
  'linkedin',
  'Q2 Retail 2026',
  3800000,
  'MXN',
  CURRENT_DATE + 3,
  'RetailMax opera 85 tiendas en CDMX y Edomex. Patricia evaluó 3 competidores y MetaTronix avanzó a la etapa final. Pain principal: pérdidas por shrinkage estimadas en $2.1M anuales. Demo de Metaview Systems realizada el 10-Abr con resultado positivo. Decisión esperada esta semana.',
  NOW() - INTERVAL '1 day'
);

-- ════════════════════════════════════════════════════════════
-- NEGOCIO 2: DataFin LATAM
-- Vertical: FinTech | Producto: QuantumTron
-- Etapa: Propuesta enviada
-- ════════════════════════════════════════════════════════════
INSERT INTO leads (
  empresa, contacto_nombre, cargo, contacto_email, contacto_telefono,
  status, fuente, campana, valor_estimado, moneda,
  seguimiento, notas, updated_at
) VALUES (
  'DataFin LATAM SAS',
  'Dr. Miguel Hernández',
  'Chief Data Officer',
  'm.hernandez@datafin.lat',
  '+57 601 555 8800',
  'propuesta_enviada',
  'evento',
  'FinTech Colombia 2026',
  6200000,
  'MXN',
  CURRENT_DATE + 7,
  'DataFin es una FinTech con operaciones en Colombia, México y Perú. 340K clientes activos, 2.8M transacciones/día. Miguel asistió a nuestro stand en FinTech Colombia. Necesitan plataforma de datos para detección de fraude en tiempo real. Propuesta de QuantumTron enviada el 8-Abr. Evaluando con su equipo técnico. Presupuesto confirmado Q2.',
  NOW() - INTERVAL '5 days'
);

-- ════════════════════════════════════════════════════════════
-- NEGOCIO 3: EduCorp Monterrey
-- Vertical: Educación | Producto: Aria New Gen
-- Etapa: Calificación
-- ════════════════════════════════════════════════════════════
INSERT INTO leads (
  empresa, contacto_nombre, cargo, contacto_email, contacto_telefono,
  status, fuente, campana, valor_estimado, moneda,
  seguimiento, notas, updated_at
) VALUES (
  'EduCorp Monterrey AC',
  'Mtro. Roberto Salinas',
  'Rector Académico',
  'r.salinas@educorp.edu.mx',
  '+52 81 8800 4400',
  'contactado',
  'referido',
  'Edu LATAM 2026',
  2100000,
  'MXN',
  CURRENT_DATE + 5,
  'EduCorp es una institución privada con 12,000 estudiantes en Monterrey. Roberto fue referido por el Tec de Monterrey (cliente existente). Interés en Aria New Gen para transformación digital del modelo educativo. Primera llamada realizada 7-Abr, muy receptivo. Necesita demo con el comité académico. Presupuesto anual de tecnología: $8M MXN.',
  NOW() - INTERVAL '2 days'
);

-- ── Verificar inserción ──────────────────────────────────────
SELECT
  id,
  empresa,
  contacto_nombre,
  status,
  valor_estimado,
  fuente,
  seguimiento,
  updated_at::date AS fecha
FROM leads
WHERE empresa IN (
  'RetailMax México SA de CV',
  'DataFin LATAM SAS',
  'EduCorp Monterrey AC'
)
ORDER BY valor_estimado DESC;

-- ── Estadísticas del pipeline después de inserción ──────────
SELECT
  status,
  COUNT(*) as leads,
  SUM(valor_estimado) as pipeline_total,
  ROUND(AVG(valor_estimado),0) as ticket_promedio
FROM leads
GROUP BY status
ORDER BY
  CASE status
    WHEN 'nuevo' THEN 1
    WHEN 'contactado' THEN 2
    WHEN 'en_negociacion' THEN 3
    WHEN 'propuesta_enviada' THEN 4
    WHEN 'cerrado_ganado' THEN 5
    WHEN 'cerrado_perdido' THEN 6
  END;
