-- ============================================================
-- FIX: Visibilidad de documentos por rol en metatronix_docs
-- Problema: docs con visibility='admin' eran visibles para
--           admin_restringido — la política solo verificaba empresa
--
-- Regla de visibilidad:
--   visibility='admin'   → solo admin y super_admin (NO admin_restringido)
--   visibility='private' → solo el propio uploader
--   visibility=NULL/'all'→ todos los miembros de la empresa
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-04-22
-- ============================================================

DROP POLICY IF EXISTS "docs_company_select" ON metatronix_docs;

CREATE POLICY "docs_company_select" ON metatronix_docs
FOR SELECT TO authenticated
USING (
  -- 1. El usuario pertenece a la empresa del documento
  user_has_company_access(company_id)
  AND (
    -- 2a. Visibilidad abierta (cualquier miembro de la empresa)
    (visibility IS NULL OR visibility NOT IN ('admin', 'private'))
    OR
    -- 2b. Usuario con rol admin o super_admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
    OR
    -- 2c. El propio uploader siempre ve sus documentos
    uploaded_by = auth.uid()
  )
);

-- Verificación
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'metatronix_docs' ORDER BY cmd;

SELECT 'Fix visibility RLS aplicado' AS resultado;
