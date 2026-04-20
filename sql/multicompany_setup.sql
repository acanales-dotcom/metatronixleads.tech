-- ============================================================
-- MULTICOMPANY SETUP — MetaTronix
-- Migración idempotente del schema de companies a UUID-based
-- Crea: user_companies, agrega slug/rfc/status a companies
-- ============================================================

-- 1. Migrar tabla companies al nuevo schema UUID-based
--    DROP CASCADE elimina la tabla vieja (con id TEXT) y cualquier
--    FK/policy que dependa de ella. CREATE reconstruye limpia.

DROP TABLE IF EXISTS user_companies CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  rfc        TEXT,
  status     TEXT NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 2. Insertar IBANOR, Starke y MetaTronix con UUIDs fijos
INSERT INTO companies (id, slug, name, rfc, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ibanor',     'IBANOR SA de CV',    'IBA000000AA1', 'activo'),
  ('b0000000-0000-0000-0000-000000000001', 'starke',     'Starke',              NULL,           'activo'),
  ('c0000000-0000-0000-0000-000000000001', 'metatronix', 'MetaTronix',          NULL,           'activo')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, status=EXCLUDED.status;

-- 3. Tabla user_companies (M:N usuarios ↔ empresas)
CREATE TABLE IF NOT EXISTS user_companies (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- 4. Policies en companies (user_companies ya existe)
DROP POLICY IF EXISTS "companies_select_member" ON companies;
DROP POLICY IF EXISTS "companies_admin_all"      ON companies;

CREATE POLICY "companies_select_member" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY "companies_admin_all" ON companies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- 5. Policies en user_companies
DROP POLICY IF EXISTS "uc_select_own" ON user_companies;
DROP POLICY IF EXISTS "uc_admin_all"  ON user_companies;

CREATE POLICY "uc_select_own" ON user_companies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "uc_admin_all" ON user_companies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- 6. Agregar company_id a metatronix_docs (si no existe)
ALTER TABLE metatronix_docs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Docs existentes → IBANOR por defecto
UPDATE metatronix_docs
  SET company_id = 'a0000000-0000-0000-0000-000000000001'
  WHERE company_id IS NULL;

-- 7. RLS metatronix_docs
DROP POLICY IF EXISTS "docs_company_select" ON metatronix_docs;
DROP POLICY IF EXISTS "docs_company_insert"  ON metatronix_docs;
DROP POLICY IF EXISTS "docs_company_delete"  ON metatronix_docs;

CREATE POLICY "docs_company_select" ON metatronix_docs
  FOR SELECT USING (
    company_id IS NULL
    OR company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY "docs_company_insert" ON metatronix_docs
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

CREATE POLICY "docs_company_delete" ON metatronix_docs
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- 8. Asignar usuarios a Starke (TODOS)
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'b0000000-0000-0000-0000-000000000001', 'member'
FROM profiles
ON CONFLICT DO NOTHING;

-- 9. Asignar usuarios a IBANOR (todos EXCEPTO ncanales)
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'a0000000-0000-0000-0000-000000000001', 'member'
FROM profiles
WHERE email NOT ILIKE 'ncanales@ibanormexico.com'
ON CONFLICT DO NOTHING;

-- Verificación final
SELECT
  p.email,
  STRING_AGG(c.name, ', ' ORDER BY c.name) AS empresas
FROM profiles p
JOIN user_companies uc ON uc.user_id = p.id
JOIN companies c ON c.id = uc.company_id
GROUP BY p.email
ORDER BY p.email;
