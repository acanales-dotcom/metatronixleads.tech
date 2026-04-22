-- ============================================================
-- RLS Fix v2: metatronix_docs — visibility='admin' es absoluto
-- admin_restringido nunca puede ver docs admin, ni los propios
--
-- Regla de visibilidad:
--   visibility='admin'   → solo admin y super_admin (ABSOLUTO)
--   visibility='private' → solo admin y super_admin (ABSOLUTO)
--   visibility=NULL/'all'→ todos los miembros de la empresa
--
-- NOTA: Se eliminó la excepción uploaded_by = auth.uid()
-- que permitía a admin_restringido ver sus propios docs 'admin'.
-- Fix de datos: 17 docs admin_restringido normalizados a 'all'.
-- Fix frontend: uploads por admin_restringido usan visibility='all'.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-04-21
-- Versión: 2
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
    -- 2b. Solo admin/super_admin ven docs 'admin' o 'private' (SIN excepción)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
);

-- Verificación
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'metatronix_docs' ORDER BY cmd;

-- Distribución de visibilidad actual
SELECT visibility, COUNT(*) AS total
FROM metatronix_docs
GROUP BY visibility ORDER BY visibility;

SELECT 'RLS v2 aplicado — visibility=admin es absoluto' AS resultado;
