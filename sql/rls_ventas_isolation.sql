-- ============================================================
-- RLS AISLAMIENTO VENTAS — MetaTronix
-- Usuarios con rol 'member' en user_companies (ej. dirección de ventas)
-- NO pueden ver a otros members ni sus datos.
-- Solo owners y admins ven todo el equipo.
-- ============================================================

-- Helper: ¿el usuario actual es solo 'member' (sin owner/admin en ninguna empresa)?
CREATE OR REPLACE FUNCTION is_sales_member_only()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  AND EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid() AND role = 'member'
  );
$$;

-- ── user_companies: member solo ve su propia membresía ────────────────────
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uc_select"        ON public.user_companies;
DROP POLICY IF EXISTS "uc_select_own"    ON public.user_companies;
DROP POLICY IF EXISTS "uc_select_admin"  ON public.user_companies;
DROP POLICY IF EXISTS "uc_insert"        ON public.user_companies;
DROP POLICY IF EXISTS "uc_update"        ON public.user_companies;
DROP POLICY IF EXISTS "uc_delete"        ON public.user_companies;

-- Siempre puede ver su propia membresía
CREATE POLICY "uc_select_own" ON public.user_companies
  FOR SELECT USING (user_id = auth.uid());

-- Owners/admins ven todas las membresías de sus empresas
CREATE POLICY "uc_select_admin" ON public.user_companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_companies my
      WHERE my.user_id = auth.uid()
        AND my.company_id = user_companies.company_id
        AND my.role IN ('owner', 'admin')
    )
  );

-- Solo super_admin/admin puede insertar/modificar membresías
CREATE POLICY "uc_insert" ON public.user_companies
  FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "uc_update" ON public.user_companies
  FOR UPDATE USING (get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "uc_delete" ON public.user_companies
  FOR DELETE USING (get_my_role() IN ('super_admin', 'admin'));

-- ── profiles: member solo ve su propio perfil ─────────────────────────────
-- (Ya existen policies profiles_select_own y profiles_select_admin)
-- Agregamos: owners también pueden ver todos los perfiles de sus empresas
DROP POLICY IF EXISTS "profiles_select_owner" ON public.profiles;
CREATE POLICY "profiles_select_owner" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_companies my
      JOIN user_companies target ON my.company_id = target.company_id
      WHERE my.user_id = auth.uid()
        AND my.role IN ('owner', 'admin')
        AND target.user_id = profiles.id
    )
  );

-- ── leads: member solo ve sus propios leads ───────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='leads') THEN

    DROP POLICY IF EXISTS "leads_select"     ON public.leads;
    DROP POLICY IF EXISTS "leads_select_own" ON public.leads;

    -- Owners/admins ven todos los leads de su empresa
    -- Members solo ven los asignados a ellos o creados por ellos
    CREATE POLICY "leads_select" ON public.leads FOR SELECT
      USING (
        company_id IS NULL
        OR (
          user_has_company_access(company_id)
          AND (
            NOT is_sales_member_only()
            OR (assigned_to = auth.uid())
            OR (created_by = auth.uid())
            OR (auth.uid()::text = (owner_id)::text)
          )
        )
      );

  END IF;
END $$;

-- ── contacts / deals / activities: mismo patrón ───────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='contacts') THEN
    DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
    CREATE POLICY "contacts_select" ON public.contacts FOR SELECT
      USING (
        company_id IS NULL
        OR (
          user_has_company_access(company_id)
          AND (NOT is_sales_member_only() OR assigned_to = auth.uid() OR created_by = auth.uid())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='deals') THEN
    DROP POLICY IF EXISTS "deals_select" ON public.deals;
    CREATE POLICY "deals_select" ON public.deals FOR SELECT
      USING (
        company_id IS NULL
        OR (
          user_has_company_access(company_id)
          AND (NOT is_sales_member_only() OR assigned_to = auth.uid() OR created_by = auth.uid())
        )
      );
  END IF;
END $$;

SELECT 'RLS aislamiento ventas aplicado' AS resultado;
