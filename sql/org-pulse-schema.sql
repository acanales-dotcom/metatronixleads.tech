-- ═══════════════════════════════════════════════════════════════════════════
-- ORG PULSE — CEO Nerve Center
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-04-18
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. TABLA org_pulse
--    Snapshot horario de métricas de toda la organización.
--    Poblada por GitHub Actions cron cada hora.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_pulse (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       uuid,                              -- NULL = todas las empresas / global

  captured_at      timestamptz NOT NULL DEFAULT now(),

  -- ── VENTAS ──────────────────────────────────────────────────
  pipeline_total         numeric  DEFAULT 0,          -- Valor total pipeline activo (MXN)
  deals_activos          int      DEFAULT 0,          -- Deals en proceso
  deals_ganados_mes      int      DEFAULT 0,          -- Ganados en el mes calendario
  deals_en_riesgo        int      DEFAULT 0,          -- Estatus en_riesgo o perdido
  leads_nuevos_7d        int      DEFAULT 0,          -- Leads creados últimos 7 días
  conversion_rate        numeric  DEFAULT 0,          -- % ganados / (ganados+perdidos) 30d

  -- ── FINANZAS ─────────────────────────────────────────────────
  cxc_total              numeric  DEFAULT 0,          -- Cuentas por cobrar total (MXN)
  cxc_vencida            numeric  DEFAULT 0,          -- CXC con fecha vencida (MXN)
  cxp_total              numeric  DEFAULT 0,          -- Cuentas por pagar total (MXN)
  cxp_proximos_30d       numeric  DEFAULT 0,          -- CXP vence en 30 días (MXN)
  flujo_neto             numeric  DEFAULT 0,          -- CXC_total - CXP_total
  dias_cobro_promedio    numeric  DEFAULT 0,          -- DSO estimado

  -- ── COBRANZA ─────────────────────────────────────────────────
  cobranza_urgente       int      DEFAULT 0,          -- CXC vencida > 60d
  cobranza_sin_contacto  int      DEFAULT 0,          -- Facturas sin contacto en 30d

  -- ── COMPRAS ──────────────────────────────────────────────────
  oc_pendientes          int      DEFAULT 0,          -- OC en estatus pendiente/borrador
  oc_monto_pendiente     numeric  DEFAULT 0,          -- Valor OC pendientes (MXN)
  requisiciones_abiertas int      DEFAULT 0,          -- Requisiciones sin OC asignada

  -- ── PLATAFORMA ───────────────────────────────────────────────
  usuarios_activos       int      DEFAULT 0,          -- Usuarios en tabla profiles
  ai_queries_24h         int      DEFAULT 0,          -- Consultas IA últimas 24h
  ai_queries_7d          int      DEFAULT 0,          -- Consultas IA últimos 7 días

  -- ── SALUD ORGANIZACIONAL ──────────────────────────────────────
  org_health_score       numeric  DEFAULT 0,          -- Score 0-100 calculado
  health_breakdown       jsonb    DEFAULT '{}',       -- Componentes del score

  -- ── META ─────────────────────────────────────────────────────
  source                 text     DEFAULT 'cron',     -- 'cron' | 'browser' | 'manual'
  created_at             timestamptz DEFAULT now()
);

-- Índices para queries eficientes
CREATE INDEX IF NOT EXISTS idx_org_pulse_captured ON org_pulse(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_pulse_company  ON org_pulse(company_id, captured_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. TABLA executive_decisions
--    Historial de preguntas del CEO + respuestas IA + snapshot de contexto.
--    Permite auditoría completa de decisiones asistidas por IA.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS executive_decisions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       uuid,
  user_id          uuid,                              -- profiles.id del CEO

  -- Contenido de la consulta
  query_text       text NOT NULL,                     -- Pregunta del CEO
  response_text    text,                              -- Respuesta del agente IA
  response_tokens  int  DEFAULT 0,

  -- Clasificación
  query_type       text DEFAULT 'ad_hoc',             -- 'daily'|'strategy'|'risk'|'week'|'ad_hoc'
  domains_queried  text[] DEFAULT '{}',               -- ['ventas','finanzas','compras',...]
  urgency_level    text DEFAULT 'normal',             -- 'critical'|'high'|'normal'|'low'

  -- Contexto org al momento de la consulta
  pulse_snapshot   jsonb DEFAULT '{}',                -- Copia del último org_pulse
  model_used       text DEFAULT 'claude-sonnet-4-6',

  -- Seguimiento de decisión
  decision_taken   text,                              -- Qué decidió el CEO (opcional, llenado después)
  decision_outcome text,                              -- Resultado de la decisión (retroalimentación)
  tags             text[] DEFAULT '{}',

  created_at       timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_exec_decisions_user    ON executive_decisions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_decisions_company ON executive_decisions(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_decisions_type    ON executive_decisions(query_type, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────

-- org_pulse: solo admin/super_admin pueden leer; servicio puede insertar
ALTER TABLE org_pulse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_pulse_select_admin" ON org_pulse;
CREATE POLICY "org_pulse_select_admin" ON org_pulse
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin','super_admin')
    )
  );

DROP POLICY IF EXISTS "org_pulse_insert_service" ON org_pulse;
CREATE POLICY "org_pulse_insert_service" ON org_pulse
  FOR INSERT WITH CHECK (true);  -- El cron usa service_role que bypassa RLS

-- executive_decisions: CEO ve sus propias decisiones; super_admin ve todas
ALTER TABLE executive_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exec_decisions_select_own" ON executive_decisions;
CREATE POLICY "exec_decisions_select_own" ON executive_decisions
  FOR SELECT USING (
    user_id = auth.uid()
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "exec_decisions_insert_admin" ON executive_decisions;
CREATE POLICY "exec_decisions_insert_admin" ON executive_decisions
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin','super_admin')
    )
  );

DROP POLICY IF EXISTS "exec_decisions_update_own" ON executive_decisions;
CREATE POLICY "exec_decisions_update_own" ON executive_decisions
  FOR UPDATE USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. FUNCIÓN get_org_pulse_latest
--    Devuelve el snapshot más reciente de org_pulse para una empresa.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_org_pulse_latest(p_company_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, captured_at timestamptz,
  pipeline_total numeric, deals_activos int, deals_ganados_mes int, deals_en_riesgo int,
  leads_nuevos_7d int, conversion_rate numeric,
  cxc_total numeric, cxc_vencida numeric, cxp_total numeric, cxp_proximos_30d numeric,
  flujo_neto numeric, cobranza_urgente int, cobranza_sin_contacto int,
  oc_pendientes int, oc_monto_pendiente numeric, requisiciones_abiertas int,
  usuarios_activos int, ai_queries_24h int, ai_queries_7d int,
  org_health_score numeric, health_breakdown jsonb, source text
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    id, captured_at,
    pipeline_total, deals_activos, deals_ganados_mes, deals_en_riesgo,
    leads_nuevos_7d, conversion_rate,
    cxc_total, cxc_vencida, cxp_total, cxp_proximos_30d,
    flujo_neto, cobranza_urgente, cobranza_sin_contacto,
    oc_pendientes, oc_monto_pendiente, requisiciones_abiertas,
    usuarios_activos, ai_queries_24h, ai_queries_7d,
    org_health_score, health_breakdown, source
  FROM org_pulse
  WHERE (p_company_id IS NULL OR company_id = p_company_id)
  ORDER BY captured_at DESC
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. FUNCIÓN compute_org_health_score
--    Calcula el score 0-100 de salud organizacional.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_org_health_score(
  p_pipeline_total numeric,
  p_cxc_vencida numeric,
  p_cxc_total numeric,
  p_deals_en_riesgo int,
  p_deals_activos int,
  p_cobranza_urgente int,
  p_oc_pendientes int,
  p_ai_queries_24h int,
  p_conversion_rate numeric
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  score numeric := 0;
  breakdown jsonb := '{}';
  s_pipeline numeric;
  s_cxc numeric;
  s_riesgo numeric;
  s_cobranza numeric;
  s_compras numeric;
  s_adoption numeric;
  s_conversion numeric;
BEGIN
  -- Pipeline activo (25 pts): más pipeline = mejor
  s_pipeline := CASE
    WHEN p_pipeline_total > 5000000  THEN 25
    WHEN p_pipeline_total > 1000000  THEN 20
    WHEN p_pipeline_total > 500000   THEN 15
    WHEN p_pipeline_total > 100000   THEN 10
    WHEN p_pipeline_total > 0        THEN 5
    ELSE 0
  END;

  -- Salud CXC (20 pts): % vencida sobre total (menos % = mejor)
  s_cxc := CASE
    WHEN p_cxc_total = 0 THEN 20
    WHEN (p_cxc_vencida / p_cxc_total) < 0.10 THEN 20
    WHEN (p_cxc_vencida / p_cxc_total) < 0.25 THEN 15
    WHEN (p_cxc_vencida / p_cxc_total) < 0.40 THEN 10
    WHEN (p_cxc_vencida / p_cxc_total) < 0.60 THEN 5
    ELSE 0
  END;

  -- Deals en riesgo (15 pts): menos riesgo = mejor
  s_riesgo := CASE
    WHEN p_deals_activos = 0 THEN 15
    WHEN p_deals_en_riesgo = 0 THEN 15
    WHEN (p_deals_en_riesgo::numeric / p_deals_activos) < 0.10 THEN 12
    WHEN (p_deals_en_riesgo::numeric / p_deals_activos) < 0.20 THEN 9
    WHEN (p_deals_en_riesgo::numeric / p_deals_activos) < 0.35 THEN 5
    ELSE 0
  END;

  -- Cobranza urgente (15 pts): menos urgente = mejor
  s_cobranza := CASE
    WHEN p_cobranza_urgente = 0 THEN 15
    WHEN p_cobranza_urgente <= 2 THEN 12
    WHEN p_cobranza_urgente <= 5 THEN 8
    WHEN p_cobranza_urgente <= 10 THEN 4
    ELSE 0
  END;

  -- Compras/OC (10 pts): pocos pendientes = mejor
  s_compras := CASE
    WHEN p_oc_pendientes = 0 THEN 10
    WHEN p_oc_pendientes <= 3 THEN 8
    WHEN p_oc_pendientes <= 8 THEN 5
    WHEN p_oc_pendientes <= 15 THEN 3
    ELSE 0
  END;

  -- Adopción IA (10 pts): más queries = mayor adopción
  s_adoption := CASE
    WHEN p_ai_queries_24h >= 20 THEN 10
    WHEN p_ai_queries_24h >= 10 THEN 8
    WHEN p_ai_queries_24h >= 5  THEN 6
    WHEN p_ai_queries_24h >= 1  THEN 3
    ELSE 0
  END;

  -- Conversión (5 pts): % conversión
  s_conversion := CASE
    WHEN p_conversion_rate >= 30 THEN 5
    WHEN p_conversion_rate >= 20 THEN 4
    WHEN p_conversion_rate >= 10 THEN 3
    WHEN p_conversion_rate >= 5  THEN 2
    ELSE 1
  END;

  score := s_pipeline + s_cxc + s_riesgo + s_cobranza + s_compras + s_adoption + s_conversion;

  breakdown := jsonb_build_object(
    'pipeline',   s_pipeline,
    'cxc_health', s_cxc,
    'riesgo',     s_riesgo,
    'cobranza',   s_cobranza,
    'compras',    s_compras,
    'ai_adoption',s_adoption,
    'conversion', s_conversion,
    'total',      score
  );

  RETURN breakdown;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. VISTA org_pulse_trend (últimas 24 horas, 1 por hora)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW org_pulse_trend AS
SELECT
  date_trunc('hour', captured_at) AS hour,
  AVG(pipeline_total)::numeric(15,2)    AS pipeline_total,
  AVG(org_health_score)::numeric(5,1)   AS health_score,
  AVG(cxc_vencida)::numeric(15,2)       AS cxc_vencida,
  AVG(deals_activos)::int               AS deals_activos,
  COUNT(*)                              AS snapshots
FROM org_pulse
WHERE captured_at > now() - interval '24 hours'
GROUP BY 1
ORDER BY 1 DESC;

-- ─────────────────────────────────────────────────────────────────────────
-- CONFIRMACIÓN
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ org_pulse + executive_decisions creadas correctamente.';
  RAISE NOTICE '✅ RLS policies configuradas.';
  RAISE NOTICE '✅ Funciones get_org_pulse_latest + compute_org_health_score listas.';
  RAISE NOTICE '✅ Vista org_pulse_trend activa.';
  RAISE NOTICE '→  Siguiente paso: ejecutar org-pulse-cron.yml GitHub Actions.';
END $$;
