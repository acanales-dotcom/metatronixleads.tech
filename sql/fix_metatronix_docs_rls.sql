-- ============================================================
-- FIX: RLS políticas para metatronix_docs
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-04-13
-- ============================================================
-- Este script corrige las políticas de Row Level Security
-- para permitir que usuarios autenticados con perplexity_enabled
-- puedan insertar estudios de mercado generados desde
-- Inteligencia de Mercados (oportunidades.html)
-- ============================================================

-- 1. Ver políticas actuales (diagnóstico)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'metatronix_docs';

-- ============================================================
-- 2. POLÍTICA: cualquier usuario autenticado puede INSERT
--    sus propios registros en metatronix_docs
-- ============================================================

-- Eliminar política anterior si existe con ese nombre
DROP POLICY IF EXISTS "authenticated_insert_own" ON metatronix_docs;
DROP POLICY IF EXISTS "users_insert_estudios" ON metatronix_docs;
DROP POLICY IF EXISTS "auth_insert_metatronix_docs" ON metatronix_docs;

-- Crear nueva política permisiva para INSERT autenticado
CREATE POLICY "auth_insert_metatronix_docs"
ON metatronix_docs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = uploaded_by
);

-- ============================================================
-- 3. POLÍTICA: SELECT — usuarios autenticados ven docs 'all'
--              admins ven todo
-- ============================================================
DROP POLICY IF EXISTS "auth_select_metatronix_docs" ON metatronix_docs;

CREATE POLICY "auth_select_metatronix_docs"
ON metatronix_docs
FOR SELECT
TO authenticated
USING (
  visibility = 'all'
  OR uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'super_admin', 'admin_restringido')
  )
);

-- ============================================================
-- 4. POLÍTICA: DELETE — solo el uploader o admin puede borrar
-- ============================================================
DROP POLICY IF EXISTS "auth_delete_metatronix_docs" ON metatronix_docs;

CREATE POLICY "auth_delete_metatronix_docs"
ON metatronix_docs
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'super_admin', 'admin_restringido')
  )
);

-- ============================================================
-- 5. VERIFICAR que las políticas quedaron correctas
-- ============================================================
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'metatronix_docs'
ORDER BY cmd;
