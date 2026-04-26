-- ============================================================
-- RLS AISLAMIENTO VENTAS — MetaTronix v2
-- Usuarios con rol 'member' en user_companies (ej. dirección de ventas)
-- NO pueden ver a otros members ni sus datos.
-- Solo owners y admins ven todo el equipo.
--
-- FIX v2: resuelve recursión infinita usando SECURITY DEFINER
-- en todas las funciones que cruzan tablas con RLS habilitado.
-- ============================================================

-- ── SECURITY DEFINER helpers (bypass RLS internamente) ────────────

-- Retorna company_ids donde el usuario actual es owner o admin
CREATE OR REPLACE FUNCTION get_my_admin_company_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM user_companies
  WHERE user_id = auth.uid() AND role IN ('owner','admin');
$$;

-- ¿El usuario actual puede ver el perfil target_uid?
-- SECURITY DEFINER para no re-entrar en las policies de user_companies/profiles
CREATE OR REPLACE FUNCTION can_view_profile(target_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target_uid = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_companies my_uc
    JOIN user_companies target_uc ON my_uc.company_id = target_uc.company_id
    WHERE my_uc.user_id = auth.uid()
      AND my_uc.role IN ('owner','admin')
      AND target_uc.user_id = target_uid
  )
  OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin');
$$;

-- Helper: ¿el usuario actual es SOLO 'member' (sin owner/admin/admin_restringido en ninguna empresa)?
-- Fix: incluir admin_restringido como rol con acceso completo a leads
CREATE OR REPLACE FUNCTION is_sales_member_only()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'admin_restringido')
  )
  AND EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid() AND role = 'member'
  );
$$;

-- ── profiles: rebuilt sin referencias directas cross-table ────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_owner" ON public.profiles;

-- Propio perfil siempre visible (sin queries externas)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Owners/admins ven perfiles de compañeros — vía SECURITY DEFINER
CREATE POLICY "profiles_select_owner" ON public.profiles
  FOR SELECT USING (can_view_profile(id));

-- ── user_companies: sin auto-referencia recursiva ─────────────────
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uc_select_own"    ON public.user_companies;
DROP POLICY IF EXISTS "uc_select_admin"  ON public.user_companies;
DROP POLICY IF EXISTS "uc_insert"        ON public.user_companies;
DROP POLICY IF EXISTS "uc_update"        ON public.user_companies;
DROP POLICY IF EXISTS "uc_delete"        ON public.user_companies;

-- Siempre puede ver su propia membresía (sin cross-table)
CREATE POLICY "uc_select_own" ON public.user_companies
  FOR SELECT USING (user_id = auth.uid());

-- Owners/admins ven membresías de sus empresas — vía SECURITY DEFINER
CREATE POLICY "uc_select_admin" ON public.user_companies
  FOR SELECT USING (
    company_id IN (SELECT get_my_admin_company_ids())
  );

-- Solo super_admin/admin puede gestionar membresías
CREATE POLICY "uc_insert" ON public.user_companies
  FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "uc_update" ON public.user_companies
  FOR UPDATE USING (get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "uc_delete" ON public.user_companies
  FOR DELETE USING (get_my_role() IN ('super_admin', 'admin'));

-- ── leads: member solo ve/modifica sus propios leads ─────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='leads') THEN

    DROP POLICY IF EXISTS "leads_select"  ON public.leads;
    DROP POLICY IF EXISTS "leads_insert"  ON public.leads;
    DROP POLICY IF EXISTS "leads_update"  ON public.leads;

    -- SELECT: owners/admins ven todos; members solo los suyos (user_id)
    CREATE POLICY "leads_select" ON public.leads FOR SELECT
      USING (
        company_id IS NULL
        OR (
          user_has_company_access(company_id)
          AND (
            NOT is_sales_member_only()
            OR user_id = auth.uid()
          )
        )
      );

    -- INSERT: company access requerido; members solo insertan como sí mismos
    CREATE POLICY "leads_insert" ON public.leads FOR INSERT
      WITH CHECK (
        user_has_company_access(company_id)
        AND (
          NOT is_sales_member_only()
          OR user_id = auth.uid()
          OR user_id IS NULL
        )
      );

    -- UPDATE: mismo patrón que SELECT
    CREATE POLICY "leads_update" ON public.leads FOR UPDATE
      USING (
        user_has_company_access(company_id)
        AND (NOT is_sales_member_only() OR user_id = auth.uid())
      );

  END IF;
END $$;

SELECT 'RLS aislamiento ventas v2 aplicado — recursión resuelta' AS resultado;
