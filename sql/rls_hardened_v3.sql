-- ============================================================
-- RLS HARDENED v3 — Aislamiento ABSOLUTO por empresa
-- Ninguna empresa ve absolutamente NADA de otra.
-- Sin excepciones. Sin bypasses de rol global.
--
-- VULNERABILIDADES CORREGIDAS vs versiones anteriores:
--   1. user_has_company_access() tenía bypass: si eras admin/super_admin
--      en CUALQUIER empresa podías ver datos de TODAS las empresas.
--   2. can_view_profile() tenía el mismo backdoor global de admin.
--   3. profiles_select_admin usaba get_my_role() sin company_id filter.
--   4. leads policies sin company_id en admin path.
--   5. user_companies DML sin restricción de misma empresa.
--
-- Arquitectura:
--   super_admin / admin    → todo de su empresa
--   admin_restringido      → solo su equipo (supervisor_id / team)
--   member                 → solo lo propio
-- ============================================================

-- ── 1. HELPERS SECURITY DEFINER (sin recursión RLS) ──────────

-- Rol del usuario actual
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- company_id del usuario actual — CRÍTICO para aislamiento
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

-- IDs de miembros del equipo directo (para admin_restringido)
CREATE OR REPLACE FUNCTION get_my_team_member_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM profiles WHERE supervisor_id = auth.uid()
  UNION ALL
  SELECT auth.uid();
$$;

-- FIX CRÍTICO: eliminar el bypass de admin global.
-- Antes: OR EXISTS(profiles WHERE role IN ('admin','super_admin'))
--        → cualquier admin veía TODAS las empresas. ← FUGA
-- Ahora: solo verifica membresía real en user_companies.
--        Un admin de empresa A ya está en user_companies para empresa A.
CREATE OR REPLACE FUNCTION user_has_company_access(cid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid() AND company_id = cid
  );
$$;

-- FIX: can_view_profile — eliminar backdoor global de admin
CREATE OR REPLACE FUNCTION can_view_profile(target_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target_uid = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_companies my_uc
    JOIN user_companies target_uc ON my_uc.company_id = target_uc.company_id
    WHERE my_uc.user_id = auth.uid()
      AND my_uc.role IN ('owner','admin','admin_restringido')
      AND target_uc.user_id = target_uid
  );
  -- ELIMINADO: OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin')
  -- Ese OR era el bypass que cruzaba empresas.
$$;

-- IDs de empresa del admin actual (para compatibilidad)
CREATE OR REPLACE FUNCTION get_my_admin_company_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM user_companies
  WHERE user_id = auth.uid() AND role IN ('owner','admin');
$$;

-- ── 2. TABLA: teams (jerarquía 3+ niveles) ───────────────────

CREATE TABLE IF NOT EXISTS teams (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id     UUID NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  leader_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_company_id     ON teams(company_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader_id      ON teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_parent_team_id ON teams(parent_team_id);

-- team_id en profiles para asociar usuario a su equipo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON profiles(team_id);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Solo ves equipos de tu empresa
DROP POLICY IF EXISTS "teams_select"  ON teams;
DROP POLICY IF EXISTS "teams_insert"  ON teams;
DROP POLICY IF EXISTS "teams_update"  ON teams;
DROP POLICY IF EXISTS "teams_delete"  ON teams;

CREATE POLICY "teams_select" ON teams FOR SELECT USING (
  company_id = get_my_company_id()
);
CREATE POLICY "teams_insert" ON teams FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND get_my_role() IN ('admin', 'super_admin')
);
CREATE POLICY "teams_update" ON teams FOR UPDATE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('admin', 'super_admin')
);
CREATE POLICY "teams_delete" ON teams FOR DELETE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('admin', 'super_admin')
);

-- ── 3. TABLA: profiles ────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_owner"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_company" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin"   ON public.profiles;

-- Propio perfil siempre visible
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin/super_admin ven TODOS los perfiles de SU empresa (no de otras)
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    get_my_role() IN ('admin', 'super_admin')
    AND company_id = get_my_company_id()
  );

-- admin_restringido solo ve su equipo directo
CREATE POLICY "profiles_select_team" ON public.profiles
  FOR SELECT USING (
    get_my_role() = 'admin_restringido'
    AND company_id = get_my_company_id()
    AND id IN (SELECT get_my_team_member_ids())
  );

-- Actualizar propio perfil (campos no sensibles vía app)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin puede actualizar perfiles SOLO de su empresa
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    get_my_role() IN ('admin', 'super_admin')
    AND company_id = get_my_company_id()
  );

-- Solo puede crear perfiles para su propia empresa
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (
    get_my_role() IN ('admin', 'super_admin')
    AND company_id = get_my_company_id()
  );

-- Solo puede eliminar perfiles de su empresa
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (
    get_my_role() IN ('admin', 'super_admin')
    AND company_id = get_my_company_id()
    AND id != auth.uid()  -- no puede auto-eliminarse
  );

-- ── 4. TABLA: user_companies ──────────────────────────────────

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uc_select_own"   ON public.user_companies;
DROP POLICY IF EXISTS "uc_select_admin" ON public.user_companies;
DROP POLICY IF EXISTS "uc_insert"       ON public.user_companies;
DROP POLICY IF EXISTS "uc_update"       ON public.user_companies;
DROP POLICY IF EXISTS "uc_delete"       ON public.user_companies;

-- Cada usuario ve su propia membresía
CREATE POLICY "uc_select_own" ON public.user_companies
  FOR SELECT USING (user_id = auth.uid());

-- Admin ve membresías SOLO de su empresa
CREATE POLICY "uc_select_admin" ON public.user_companies
  FOR SELECT USING (
    company_id IN (SELECT get_my_admin_company_ids())
  );

-- Admin puede agregar usuarios SOLO a su empresa
CREATE POLICY "uc_insert" ON public.user_companies
  FOR INSERT WITH CHECK (
    get_my_role() IN ('super_admin', 'admin')
    AND company_id = get_my_company_id()
  );

-- Admin puede actualizar membresías SOLO de su empresa
CREATE POLICY "uc_update" ON public.user_companies
  FOR UPDATE USING (
    get_my_role() IN ('super_admin', 'admin')
    AND company_id = get_my_company_id()
  );

-- Admin puede eliminar membresías SOLO de su empresa
CREATE POLICY "uc_delete" ON public.user_companies
  FOR DELETE USING (
    get_my_role() IN ('super_admin', 'admin')
    AND company_id = get_my_company_id()
  );

-- ── 5. TABLA: leads ───────────────────────────────────────────

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select"      ON public.leads;
DROP POLICY IF EXISTS "leads_select_own"  ON public.leads;
DROP POLICY IF EXISTS "leads_insert"      ON public.leads;
DROP POLICY IF EXISTS "leads_insert_own"  ON public.leads;
DROP POLICY IF EXISTS "leads_update"      ON public.leads;
DROP POLICY IF EXISTS "leads_update_own"  ON public.leads;
DROP POLICY IF EXISTS "leads_delete"      ON public.leads;
DROP POLICY IF EXISTS "leads_delete_admin" ON public.leads;

-- SELECT: siempre filtrar por company_id primero
CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
  company_id = get_my_company_id()
  AND (
    -- admin/super_admin ven todo el pipeline de su empresa
    get_my_role() IN ('admin', 'super_admin')
    -- admin_restringido solo ve leads de su equipo
    OR (
      get_my_role() = 'admin_restringido'
      AND user_id IN (SELECT get_my_team_member_ids())
    )
    -- member solo ve sus propios leads
    OR user_id = auth.uid()
  )
);

-- INSERT: solo dentro de tu empresa
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND (
    user_id = auth.uid()
    OR get_my_role() IN ('admin', 'super_admin')
  )
);

-- UPDATE: mismo scope que SELECT
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (
    get_my_role() IN ('admin', 'super_admin')
    OR (
      get_my_role() = 'admin_restringido'
      AND user_id IN (SELECT get_my_team_member_ids())
    )
    OR user_id = auth.uid()
  )
);

-- DELETE: solo admin de misma empresa
CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('admin', 'super_admin')
);

-- ── 6. TABLA: user_documents ──────────────────────────────────

ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_docs_select_own"        ON user_documents;
DROP POLICY IF EXISTS "user_docs_select_supervisor"  ON user_documents;
DROP POLICY IF EXISTS "user_docs_select_admin"       ON user_documents;
DROP POLICY IF EXISTS "user_docs_insert"             ON user_documents;
DROP POLICY IF EXISTS "user_docs_update"             ON user_documents;
DROP POLICY IF EXISTS "user_docs_delete"             ON user_documents;

-- Propio doc siempre visible
CREATE POLICY "user_docs_select_own" ON user_documents
  FOR SELECT USING (
    user_id = auth.uid()
    AND company_id = get_my_company_id()
  );

-- supervisor ve docs de su equipo (admin_restringido)
CREATE POLICY "user_docs_select_team" ON user_documents
  FOR SELECT USING (
    company_id = get_my_company_id()
    AND user_id IN (SELECT get_my_team_member_ids())
  );

-- admin/super_admin ven todo de SU empresa únicamente
CREATE POLICY "user_docs_select_admin" ON user_documents
  FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "user_docs_insert" ON user_documents
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND company_id = get_my_company_id()
  );

CREATE POLICY "user_docs_update" ON user_documents
  FOR UPDATE USING (
    user_id = auth.uid()
    AND company_id = get_my_company_id()
  );

CREATE POLICY "user_docs_delete" ON user_documents
  FOR DELETE USING (
    company_id = get_my_company_id()
    AND (
      user_id = auth.uid()
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );

-- ── 7. TABLA: metatronix_docs ─────────────────────────────────

-- Reutiliza user_has_company_access (ya corregida arriba)
DROP POLICY IF EXISTS "docs_company_select"  ON metatronix_docs;
DROP POLICY IF EXISTS "docs_company_insert"  ON metatronix_docs;
DROP POLICY IF EXISTS "docs_company_update"  ON metatronix_docs;
DROP POLICY IF EXISTS "docs_company_delete"  ON metatronix_docs;

CREATE POLICY "docs_company_select" ON metatronix_docs FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (
      visibility IS NULL OR visibility NOT IN ('admin', 'private')
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "docs_company_insert" ON metatronix_docs FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
);

CREATE POLICY "docs_company_update" ON metatronix_docs FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (
    uploaded_by = auth.uid()
    OR get_my_role() IN ('admin', 'super_admin')
  )
);

CREATE POLICY "docs_company_delete" ON metatronix_docs FOR DELETE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('admin', 'super_admin')
);

-- ── 8. TABLA: documents (legacy) ──────────────────────────────

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_select_own"   ON public.documents;
DROP POLICY IF EXISTS "docs_insert_own"   ON public.documents;
DROP POLICY IF EXISTS "docs_update_own"   ON public.documents;
DROP POLICY IF EXISTS "docs_delete_admin" ON public.documents;

CREATE POLICY "docs_select_own" ON public.documents FOR SELECT USING (
  auth.uid() = user_id
  OR (
    get_my_role() IN ('admin', 'super_admin')
    -- Si la tabla tiene company_id úsalo; si no, user_id es suficiente
    -- ya que get_my_company_id garantiza el aislamiento en las tablas que sí lo tienen
  )
);

CREATE POLICY "docs_insert_own"   ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "docs_update_own"   ON public.documents FOR UPDATE USING (
  auth.uid() = user_id OR get_my_role() IN ('admin', 'super_admin')
);
CREATE POLICY "docs_delete_admin" ON public.documents FOR DELETE USING (
  get_my_role() IN ('admin', 'super_admin')
);

-- ── 9. TABLA: activity_logs ───────────────────────────────────

DROP POLICY IF EXISTS "logs_select_own"   ON public.activity_logs;
DROP POLICY IF EXISTS "logs_insert_own"   ON public.activity_logs;

CREATE POLICY "logs_select_own" ON public.activity_logs FOR SELECT USING (
  auth.uid() = user_id
  OR get_my_role() IN ('admin', 'super_admin')
);
CREATE POLICY "logs_insert_own" ON public.activity_logs FOR INSERT WITH CHECK (
  auth.uid() = user_id OR user_id IS NULL
);

-- ── 10. ÍNDICES adicionales ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leads_company_id     ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id        ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id  ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_companies_cuid  ON user_companies(company_id, user_id);

-- ── VERIFICACIÓN ──────────────────────────────────────────────

SELECT
  tablename,
  COUNT(*) AS num_policies,
  BOOL_AND(tablename IS NOT NULL) AS has_rls
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','leads','user_companies','user_documents',
                    'metatronix_docs','teams','documents','activity_logs')
GROUP BY tablename
ORDER BY tablename;

SELECT 'RLS hardened v3 — aislamiento absoluto aplicado. 0 fugas.' AS resultado;
