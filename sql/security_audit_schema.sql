-- ============================================================
-- METATRONIX SECURITY — Audit & Compliance Schema
-- SOC 2 Type II / ISO 27001:2022
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Enhanced activity_logs (ya existe, añadir columnas) ──
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS ip_address     TEXT,
  ADD COLUMN IF NOT EXISTS user_agent     TEXT,
  ADD COLUMN IF NOT EXISTS severity       TEXT DEFAULT 'info'
    CHECK (severity IN ('info','warning','error','critical')),
  ADD COLUMN IF NOT EXISTS session_id     TEXT,
  ADD COLUMN IF NOT EXISTS is_security    BOOLEAN DEFAULT FALSE;

-- ── 2. Security events table ───────────────────────────────
CREATE TABLE IF NOT EXISTS security_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email    TEXT,
  severity      TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','error','critical')),
  description   TEXT,
  metadata      JSONB DEFAULT '{}',
  ip_address    TEXT,
  user_agent    TEXT,
  page          TEXT,
  resolved      BOOLEAN DEFAULT FALSE,
  resolved_by   UUID REFERENCES profiles(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read security events
CREATE POLICY "super_admin_security_events" ON security_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Any authenticated user can INSERT (needed for client-side logging)
CREATE POLICY "auth_insert_security_events" ON security_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ── 3. Data retention policy implementation ────────────────
-- Creates a view for data subject to retention policy
CREATE OR REPLACE VIEW leads_retention_check AS
SELECT
  id, empresa, updated_at, status,
  EXTRACT(DAYS FROM NOW() - updated_at) AS days_since_update,
  CASE
    WHEN status = 'cerrado_perdido' AND updated_at < NOW() - INTERVAL '3 years'
    THEN 'SCHEDULE_DELETION'
    WHEN status NOT IN ('cerrado_ganado','cerrado_perdido')
    AND updated_at < NOW() - INTERVAL '2 years'
    THEN 'REVIEW_REQUIRED'
    ELSE 'ACTIVE'
  END AS retention_status
FROM leads;

-- ── 4. Audit log view for super admin ──────────────────────
CREATE OR REPLACE VIEW admin_audit_view AS
SELECT
  al.id,
  al.created_at,
  al.action,
  al.entity_type,
  al.entity_id,
  al.metadata,
  al.severity,
  al.is_security,
  p.email AS user_email,
  p.full_name AS user_name,
  p.role AS user_role
FROM activity_logs al
LEFT JOIN profiles p ON p.id = al.user_id
ORDER BY al.created_at DESC;

-- Only super_admin/admin can read
GRANT SELECT ON admin_audit_view TO authenticated;
CREATE POLICY "admin_view_audit" ON activity_logs FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.role IN ('admin','super_admin'))
  );

-- ── 5. Verification queries ────────────────────────────────
SELECT 'security_events table' AS object, COUNT(*) FROM security_events;
SELECT 'activity_logs enhanced' AS object, COUNT(*) FROM activity_logs;
