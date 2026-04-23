-- ============================================================
-- FIX: Aislamiento multi-empresa para documentos
-- Problema: documentos de nibarra aparecen en empresa de acanales
-- y viceversa.
--
-- Causas raíz:
--   1. user_has_company_access() otorgaba bypass a TODO usuario
--      con role 'admin', sin importar a qué empresa pertenece.
--   2. metatronix_docs SELECT policy usaba visibility='all' (sin
--      filtro de empresa) y bypass de admins sin scope de empresa.
--   3. Múltiples políticas activas simultáneamente se combinan con
--      OR en Supabase (permissive), la más permisiva gana.
--
-- Fix:
--   1. user_has_company_access() — solo super_admin bypassa,
--      admin solo accede a empresas asignadas vía user_companies.
--   2. metatronix_docs — DROP todas las políticas SELECT existentes
--      y crear una sola con aislamiento estricto por company_id.
--   3. documents — misma corrección.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-04-21
-- ============================================================

-- ── 1. CORREGIR user_has_company_access() ───────────────────
-- ANTES: ANY admin/super_admin pasa → acceso cross-empresa
-- DESPUÉS: solo super_admin bypassa; admin solo ve sus empresas
CREATE OR REPLACE FUNCTION user_has_company_access(cid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    -- El usuario está asignado a esta empresa específica
    EXISTS (
      SELECT 1 FROM user_companies
      WHERE user_id = auth.uid() AND company_id = cid
    )
    OR
    -- Únicamente super_admin (nivel CEO) ve todas las empresas
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    );
$$;

-- ── 2. CORREGIR metatronix_docs — DROP todas las políticas ──
-- Hay múltiples políticas activas que se combinan con OR.
-- Debemos dropear TODAS y crear solo una correcta.
DROP POLICY IF EXISTS "docs_company_select"        ON metatronix_docs;
DROP POLICY IF EXISTS "auth_select_metatronix_docs" ON metatronix_docs;
DROP POLICY IF EXISTS "metatronix_docs_select"     ON metatronix_docs;
DROP POLICY IF EXISTS "select_own_docs"            ON metatronix_docs;
DROP POLICY IF EXISTS "docs_select"                ON metatronix_docs;

-- Política única: acceso estrictamente por company_id
-- super_admin ve todo; admin y resto solo su(s) empresa(s)
CREATE POLICY "docs_company_select" ON metatronix_docs
FOR SELECT TO authenticated
USING (
  user_has_company_access(company_id)
);

-- INSERT — el usuario debe pertenecer a la empresa destino
DROP POLICY IF EXISTS "docs_company_insert"          ON metatronix_docs;
DROP POLICY IF EXISTS "auth_insert_metatronix_docs"  ON metatronix_docs;
DROP POLICY IF EXISTS "users_insert_estudios"        ON metatronix_docs;
DROP POLICY IF EXISTS "authenticated_insert_own"     ON metatronix_docs;

CREATE POLICY "docs_company_insert" ON metatronix_docs
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND user_has_company_access(company_id)
);

-- DELETE — solo el uploader o super_admin puede borrar
DROP POLICY IF EXISTS "docs_company_delete"          ON metatronix_docs;
DROP POLICY IF EXISTS "auth_delete_metatronix_docs"  ON metatronix_docs;

CREATE POLICY "docs_company_delete" ON metatronix_docs
FOR DELETE TO authenticated
USING (
  (uploaded_by = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ))
  AND user_has_company_access(company_id)
);

-- ── 3. CORREGIR documents — aislamiento por company_id ──────
-- (tabla usada por otros módulos, no por archivos.html
--  pero tiene el mismo problema de bypass de admins)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='documents'
  ) THEN

    DROP POLICY IF EXISTS "documents_select"     ON documents;
    DROP POLICY IF EXISTS "docs_select"          ON documents;
    DROP POLICY IF EXISTS "allow_select_own"     ON documents;

    CREATE POLICY "documents_select" ON documents
    FOR SELECT TO authenticated
    USING (
      -- Si la tabla tiene company_id, filtra por él
      (company_id IS NOT NULL AND user_has_company_access(company_id))
      -- Si no tiene company_id, solo el dueño del documento lo ve
      OR (company_id IS NULL AND user_id = auth.uid())
    );

    DROP POLICY IF EXISTS "documents_insert" ON documents;
    CREATE POLICY "documents_insert" ON documents
    FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid()
      AND (company_id IS NULL OR user_has_company_access(company_id))
    );

    DROP POLICY IF EXISTS "documents_delete" ON documents;
    CREATE POLICY "documents_delete" ON documents
    FOR DELETE TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
      )
    );

  END IF;
END $$;

-- ── 4. VERIFICAR resultado ───────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('metatronix_docs', 'documents')
ORDER BY tablename, cmd;

SELECT 'Aislamiento multi-empresa corregido' AS resultado;
