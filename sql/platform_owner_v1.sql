-- ============================================================
-- PLATFORM OWNER V1 — God Mode para MetaTronix
-- Ejecutar como: service_role en Supabase SQL Editor
-- ============================================================

-- 1. Tabla de admins globales (sin RLS, solo service_role puede insertar)
CREATE TABLE IF NOT EXISTS platform_admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE platform_admins DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_admins FROM anon, authenticated;
GRANT SELECT ON platform_admins TO authenticated;

-- 2. Tabla maestra de empresas (source of truth para todas las compañías)
CREATE TABLE IF NOT EXISTS companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE,
  plan         TEXT DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','trial','nexus')),
  is_nexus     BOOLEAN DEFAULT false,
  owner_email  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id),
  last_seen_at TIMESTAMPTZ,
  meta         JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_is_nexus ON companies(is_nexus);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- RLS companies: solo platform_owner lee todo; empresa solo se lee a sí misma
CREATE POLICY "companies_platform_owner_all"
  ON companies FOR ALL
  USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()));

CREATE POLICY "companies_self_select"
  ON companies FOR SELECT TO authenticated
  USING (id = get_my_company_id());

-- 3. Función is_platform_owner()
CREATE OR REPLACE FUNCTION is_platform_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 4. Vista de salud de empresas (acceso solo vía service_role o SECURITY DEFINER)
CREATE OR REPLACE VIEW company_health AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.plan,
  c.status,
  c.is_nexus,
  c.owner_email,
  c.created_at,
  c.last_seen_at,
  (SELECT COUNT(*)::INT FROM profiles          WHERE company_id = c.id)  AS user_count,
  (SELECT COUNT(*)::INT FROM leads             WHERE company_id = c.id)  AS lead_count,
  (SELECT COUNT(*)::INT FROM metatronix_docs   WHERE company_id = c.id)  AS doc_count,
  (SELECT COUNT(*)::INT FROM user_documents    WHERE company_id = c.id)  AS udoc_count,
  (SELECT MAX(created_at) FROM leads           WHERE company_id = c.id)  AS last_lead_at,
  CASE
    WHEN c.status = 'suspended' THEN 'suspended'
    WHEN (SELECT COUNT(*) FROM profiles WHERE company_id = c.id) = 0 THEN 'critical'
    WHEN c.last_seen_at IS NULL OR c.last_seen_at < NOW() - INTERVAL '30 days' THEN 'warning'
    ELSE 'healthy'
  END AS health_status
FROM companies c;

-- SECURITY DEFINER wrapper para que platform_owner lea la vista sin RLS
CREATE OR REPLACE FUNCTION get_all_companies_health()
RETURNS TABLE (
  id UUID, name TEXT, slug TEXT, plan TEXT, status TEXT,
  is_nexus BOOLEAN, owner_email TEXT, created_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ, user_count INT, lead_count INT,
  doc_count INT, udoc_count INT, last_lead_at TIMESTAMPTZ,
  health_status TEXT
) AS $$
BEGIN
  IF NOT is_platform_owner() THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere platform_owner';
  END IF;
  RETURN QUERY SELECT * FROM company_health ORDER BY health_status DESC, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Función para registrar nueva empresa (solo platform_owner)
CREATE OR REPLACE FUNCTION register_company(
  p_name       TEXT,
  p_slug       TEXT,
  p_plan       TEXT DEFAULT 'starter',
  p_owner_email TEXT DEFAULT NULL
) RETURNS companies AS $$
DECLARE
  v_company companies;
BEGIN
  IF NOT is_platform_owner() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  INSERT INTO companies (name, slug, plan, owner_email, created_by, status)
  VALUES (p_name, lower(regexp_replace(p_slug, '[^a-z0-9]', '-', 'g')),
          p_plan, p_owner_email, auth.uid(), 'active')
  RETURNING * INTO v_company;
  RETURN v_company;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Tabla de audit log de la plataforma
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  details     JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_log(created_at DESC);
ALTER TABLE platform_audit_log DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_audit_log FROM anon, authenticated;
GRANT SELECT, INSERT ON platform_audit_log TO authenticated;

-- 7. Tabla nexus_deploys — historial de cambios Nexus → Producción
CREATE TABLE IF NOT EXISTS nexus_deploys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version      TEXT NOT NULL,
  description  TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','deploying','deployed','failed','rolled_back')),
  changes      JSONB DEFAULT '[]'::jsonb,
  test_results JSONB DEFAULT '{}'::jsonb,
  approved_by  UUID REFERENCES auth.users(id),
  deployed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id)
);
ALTER TABLE nexus_deploys DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON nexus_deploys TO authenticated;

-- 8. Insertar empresa NEXUS (ambiente demo)
INSERT INTO companies (name, slug, plan, status, is_nexus, owner_email)
VALUES ('NEXUS — Demo Environment', 'nexus-demo', 'enterprise', 'nexus', true, 'nexus@metatronixleads.tech')
ON CONFLICT (slug) DO NOTHING;

-- ✅ Platform Owner V1 instalado
SELECT 'platform_owner_v1 OK — tablas: companies, platform_admins, platform_audit_log, nexus_deploys' AS status;
