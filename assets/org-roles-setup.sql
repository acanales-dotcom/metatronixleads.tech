-- ============================================================
-- METATRONIXLEADS.TECH — Estructura Organizacional Completa
-- 6 niveles de rol + soporte multi-empresa
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- ── 1. AGREGAR COLUMNAS DE ROL EXTENDIDO ─────────────────────
-- Agregar 'company_id' para soporte multi-empresa
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'metatronix',
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consejo_limit INTEGER DEFAULT 20;

-- ── 2. TABLA DE EMPRESAS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id           TEXT PRIMARY KEY,          -- slug, ej: 'metatronix', 'ibanor'
  name         TEXT NOT NULL,
  logo_url     TEXT,
  primary_color TEXT DEFAULT '#00ff88',
  owner_email  TEXT,
  plan         TEXT DEFAULT 'pro',        -- free, pro, enterprise
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar empresas iniciales
INSERT INTO companies (id, name, owner_email, plan) VALUES
  ('metatronix', 'MetaTronix', 'acanales@ibanormexico.com', 'enterprise'),
  ('ibanor',     'IBANOR SA de CV', 'acanales@ibanormexico.com', 'pro')
ON CONFLICT (id) DO NOTHING;

-- ── 3. CHECK CONSTRAINT EN PROFILES (roles válidos) ───────────
-- Primero eliminar constraint anterior si existe
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','admin_restringido','user','viewer','readonly'));

-- ── 4. LÍMITES DE CLAUDE POR ROL (actualizar si claude_monthly_limit existe) ──
UPDATE profiles SET claude_monthly_limit = CASE
  WHEN role = 'super_admin'       THEN 9999
  WHEN role = 'admin'             THEN 200
  WHEN role = 'admin_restringido' THEN 50
  WHEN role = 'user'              THEN 20
  WHEN role = 'viewer'            THEN 5
  WHEN role = 'readonly'          THEN 0
  ELSE 20
END
WHERE claude_monthly_limit IS NOT NULL;

-- ── 5. LÍMITES EN consejo_limit ───────────────────────────────
UPDATE profiles SET consejo_limit = CASE
  WHEN role = 'super_admin'       THEN 9999  -- ilimitado
  WHEN role = 'admin'             THEN 200
  WHEN role = 'admin_restringido' THEN 50
  WHEN role = 'user'              THEN 20
  WHEN role = 'viewer'            THEN 5
  WHEN role = 'readonly'          THEN 0
  ELSE 20
END;

-- ── 6. RLS PARA COMPANIES ─────────────────────────────────────
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_read_own" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "companies_manage_superadmin" ON companies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── 7. FUNCIÓN RPC: obtener rol y empresa del usuario ─────────
CREATE OR REPLACE FUNCTION get_my_org_context()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  p profiles%ROWTYPE;
  c companies%ROWTYPE;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN '{}'::JSONB; END IF;

  SELECT * INTO c FROM companies WHERE id = p.company_id;

  RETURN jsonb_build_object(
    'user_id',     p.id,
    'role',        p.role,
    'department',  p.department,
    'job_title',   p.job_title,
    'company_id',  p.company_id,
    'company_name',COALESCE(c.name, p.company_id),
    'claude_limit',p.consejo_limit,
    'plan',        COALESCE(c.plan, 'pro')
  );
END;
$$;

-- ── 8. ÍNDICE PARA CONSULTAS POR EMPRESA ─────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ── 9. ACTUALIZAR USUARIOS EXISTENTES CON EMPRESA ────────────
UPDATE profiles SET company_id = 'ibanor'
WHERE email LIKE '%@ibanormexico.com' AND company_id = 'metatronix';

-- ── 10. VISTA: directorio organizacional ─────────────────────
CREATE OR REPLACE VIEW org_directory AS
SELECT
  p.id, p.full_name, p.email, p.role, p.department,
  p.job_title, p.company_id, c.name AS company_name,
  p.is_active, p.last_seen, p.consejo_limit
FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
WHERE p.is_active = true
ORDER BY
  CASE p.role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'admin_restringido' THEN 3
    WHEN 'user' THEN 4
    WHEN 'viewer' THEN 5
    WHEN 'readonly' THEN 6
  END, p.full_name;

-- ── VERIFICACIÓN ──────────────────────────────────────────────
SELECT role, COUNT(*) as usuarios, AVG(consejo_limit) as limite_promedio
FROM profiles
GROUP BY role ORDER BY 3 DESC;
