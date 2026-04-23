-- ============================================================
-- MetaTronix — Sistema Nervioso Central
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ── 1. TABLA CENTRAL DE EVENTOS ──────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      VARCHAR(100) NOT NULL,  -- 'lead.won', 'invoice.overdue_30', etc.
  module          VARCHAR(50)  NOT NULL,  -- 'ventas', 'finanzas', 'cobranza', etc.
  company_id      TEXT REFERENCES companies(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_id       UUID,                   -- ID del lead, factura, etc.
  entity_type     VARCHAR(50),            -- 'lead', 'invoice', 'purchase_order'
  payload         JSONB        DEFAULT '{}',
  revenue_impact  DECIMAL(12,2),          -- $ afectados por este evento
  severity        VARCHAR(10)  DEFAULT 'info', -- 'info', 'warn', 'critical', 'ok'
  processed       BOOLEAN      DEFAULT FALSE,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_company    ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_type       ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_severity   ON events(severity) WHERE severity IN ('warn','critical');
CREATE INDEX IF NOT EXISTS idx_events_created    ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON events(processed) WHERE processed = FALSE;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_own_company" ON events FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "events_insert_authenticated" ON events FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- ── 2. CUENTAS POR COBRAR (vinculadas a Yaydoo/Listo) ────────
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          TEXT REFERENCES companies(id),
  lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
  client_name         TEXT NOT NULL,
  client_email        TEXT,
  cfdi_uuid           TEXT,              -- UUID SAT del CFDI
  folio               TEXT,
  amount              DECIMAL(12,2) NOT NULL,
  currency            VARCHAR(3)    DEFAULT 'MXN',
  status              VARCHAR(20)   DEFAULT 'pendiente', -- pendiente, pagado, vencido, en_cobranza
  due_date            DATE,
  paid_at             TIMESTAMPTZ,
  overdue_days        INT GENERATED ALWAYS AS (
    CASE WHEN status != 'pagado' AND due_date IS NOT NULL
         THEN GREATEST(0, EXTRACT(DAY FROM NOW() - due_date)::INT)
         ELSE 0 END
  ) STORED,
  yaydoo_payment_id   TEXT,
  listo_cfdi_id       TEXT,
  collection_notes    TEXT,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_company   ON accounts_receivable(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_status    ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_ar_overdue   ON accounts_receivable(overdue_days) WHERE status != 'pagado';

ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_company_access" ON accounts_receivable FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

-- ── 3. NUEVAS COLUMNAS EN LEADS ───────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source              VARCHAR(50),     -- 'whatsapp','web','llamada','referido'
  ADD COLUMN IF NOT EXISTS campaign_id         UUID,            -- campaña que lo originó
  ADD COLUMN IF NOT EXISTS whatsapp_thread_id  TEXT,            -- ID del hilo en Leadsales
  ADD COLUMN IF NOT EXISTS call_score          SMALLINT,        -- 0-100 score Diio
  ADD COLUMN IF NOT EXISTS call_notes          TEXT,            -- transcripción IA de llamada
  ADD COLUMN IF NOT EXISTS call_recording_url  TEXT,            -- URL de grabación
  ADD COLUMN IF NOT EXISTS last_contact_at     TIMESTAMPTZ,     -- último contacto real
  ADD COLUMN IF NOT EXISTS payment_status      VARCHAR(20),     -- estado de cobro
  ADD COLUMN IF NOT EXISTS stalled_since       TIMESTAMPTZ,     -- cuándo se paralizó
  ADD COLUMN IF NOT EXISTS revenue_impact      DECIMAL(12,2),   -- MXN estimados
  ADD COLUMN IF NOT EXISTS blocked_by_debt     BOOLEAN DEFAULT FALSE; -- bloqueado por deuda

CREATE INDEX IF NOT EXISTS idx_leads_source       ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_stalled      ON leads(stalled_since) WHERE stalled_since IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_blocked      ON leads(blocked_by_debt) WHERE blocked_by_debt = TRUE;

-- ── 4. SISTEMA DE FEEDBACK PROPIO (reemplaza Savio) ──────────
CREATE TABLE IF NOT EXISTS feature_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      TEXT REFERENCES companies(id),
  title           TEXT NOT NULL,
  description     TEXT,
  category        VARCHAR(50) DEFAULT 'feature', -- 'feature','bug','improvement','integration'
  status          VARCHAR(30) DEFAULT 'backlog',  -- backlog, evaluando, planeado, en_desarrollo, lanzado, descartado
  priority_score  INT DEFAULT 0,     -- calculado: SUM de plan_value de empresas que lo pidieron
  votes_count     INT DEFAULT 0,
  module          VARCHAR(50),       -- qué módulo del portal afecta
  created_by      UUID REFERENCES auth.users(id),
  assigned_to     UUID REFERENCES auth.users(id),
  target_release  TEXT,              -- 'Q2-2026', etc.
  launched_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_request_id  UUID REFERENCES feature_requests(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id),
  company_id          TEXT REFERENCES companies(id),
  message             TEXT NOT NULL,
  source_module       VARCHAR(50),   -- dónde estaba el usuario al enviar feedback
  type                VARCHAR(20) DEFAULT 'feedback', -- 'feedback','bug_report','question'
  sentiment           VARCHAR(10),   -- 'positive','neutral','negative'
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_votes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_request_id  UUID REFERENCES feature_requests(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id),
  company_id          TEXT REFERENCES companies(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feature_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fr_status        ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_fr_priority      ON feature_requests(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_fi_request       ON feedback_items(feature_request_id);
CREATE INDEX IF NOT EXISTS idx_fv_request       ON feedback_votes(feature_request_id);

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fr_read_all_authenticated" ON feature_requests FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "fr_write_admin" ON feature_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

CREATE POLICY "fi_read_all" ON feedback_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "fi_insert_own" ON feedback_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "fv_read_all"   ON feedback_votes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "fv_insert_own" ON feedback_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));
CREATE POLICY "fv_delete_own" ON feedback_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 5. INTEGRACIONES EXTERNAS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      TEXT REFERENCES companies(id),
  app_name        VARCHAR(50) NOT NULL,
  direction       VARCHAR(10) DEFAULT 'outbound', -- 'inbound' | 'outbound'
  endpoint        VARCHAR(255),
  status_code     SMALLINT,
  payload         JSONB,
  response        JSONB,
  error_message   TEXT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      TEXT REFERENCES companies(id),
  app_name        VARCHAR(50) NOT NULL,  -- 'leadsales','yaydoo','listo','buk','monday','diio','jelou'
  is_active       BOOLEAN DEFAULT FALSE,
  webhook_url     TEXT,
  config          JSONB DEFAULT '{}',   -- {board_id, tenant, buk_country, etc}
  last_sync_at    TIMESTAMPTZ,
  error_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, app_name)
);

CREATE INDEX IF NOT EXISTS idx_ilog_company   ON integrations_log(company_id);
CREATE INDEX IF NOT EXISTS idx_ilog_app       ON integrations_log(app_name);
CREATE INDEX IF NOT EXISTS idx_ilog_created   ON integrations_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_company     ON app_integrations(company_id);

ALTER TABLE integrations_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ilog_admin_access" ON integrations_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));
CREATE POLICY "ai_admin_access" ON app_integrations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

-- ── 6. FUNCIÓN: CALCULAR MetaTronix Score ─────────────────────
CREATE OR REPLACE FUNCTION get_metatronix_score(p_company_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_pipeline_score    NUMERIC;
  v_collection_score  NUMERIC;
  v_activity_score    NUMERIC;
  v_satisfaction_score NUMERIC;
  v_ops_score         NUMERIC;
  v_total             NUMERIC;
  v_details           JSONB;
BEGIN
  -- Pipeline health (30%): deals activos vs vencidos
  SELECT COALESCE(
    100.0 * COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days')
    / NULLIF(COUNT(*), 0), 50
  ) INTO v_pipeline_score
  FROM leads WHERE company_id = p_company_id AND status NOT IN ('cerrado_ganado','cerrado_perdido');

  -- Collection health (25%): facturas al día
  SELECT COALESCE(
    100.0 * COUNT(*) FILTER (WHERE status = 'pagado' OR overdue_days <= 15)
    / NULLIF(COUNT(*), 0), 70
  ) INTO v_collection_score
  FROM accounts_receivable WHERE company_id = p_company_id;

  -- Activity score (20%): usuarios activos últimas 24h
  SELECT COALESCE(
    100.0 * COUNT(DISTINCT user_id) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')
    / NULLIF(COUNT(DISTINCT user_id), 0), 60
  ) INTO v_activity_score
  FROM events WHERE company_id = p_company_id AND created_at > NOW() - INTERVAL '7 days';

  -- Satisfaction (15%): feedback positivo vs negativo
  SELECT COALESCE(
    100.0 * COUNT(*) FILTER (WHERE sentiment = 'positive')
    / NULLIF(COUNT(*), 0), 70
  ) INTO v_satisfaction_score
  FROM feedback_items WHERE company_id = p_company_id AND created_at > NOW() - INTERVAL '30 days';

  -- Ops (10%): POs sin resolver
  v_ops_score := 75; -- baseline, mejora con datos reales

  v_total := (v_pipeline_score * 0.30) + (v_collection_score * 0.25) +
             (v_activity_score * 0.20) + (v_satisfaction_score * 0.15) +
             (v_ops_score * 0.10);

  v_details := jsonb_build_object(
    'total',        ROUND(v_total),
    'pipeline',     ROUND(v_pipeline_score),
    'collection',   ROUND(v_collection_score),
    'activity',     ROUND(v_activity_score),
    'satisfaction', ROUND(v_satisfaction_score),
    'ops',          ROUND(v_ops_score)
  );

  RETURN v_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar Realtime en events (para CEO dashboard en tiempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE accounts_receivable;
ALTER PUBLICATION supabase_realtime ADD TABLE feature_requests;

SELECT 'Sistema Nervioso Central instalado correctamente' AS resultado;
