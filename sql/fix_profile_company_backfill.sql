-- ============================================================
-- FIX: Backfill profiles.company_id desde user_companies
--
-- Problema: usuarios migrados (jorge, noe, rsuarez, clopez, etc.)
-- tienen company_id = NULL en profiles aunque sí aparecen en
-- user_companies. Como RLS de leads evalúa
--   user_has_company_access(company_id)
-- y getActiveCompanyId() en el front lee profiles.company_id,
-- cualquier INSERT con company_id=NULL falla con violación RLS.
--
-- Fix: copiar company_id del primer registro en user_companies
-- a profiles donde company_id esté vacío.
--
-- Seguro de re-ejecutar (no sobreescribe si ya tiene valor).
-- ============================================================

-- 1. Backfill profiles.company_id para usuarios sin él
UPDATE public.profiles p
SET
  company_id = uc.company_id,
  updated_at = now()
FROM (
  -- Para cada usuario sin company_id, tomar la empresa de mayor jerarquía
  SELECT DISTINCT ON (user_id)
    user_id,
    company_id
  FROM public.user_companies
  ORDER BY user_id,
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin'       THEN 2
      WHEN 'admin_restringido' THEN 3
      WHEN 'owner'       THEN 4
      ELSE 5
    END
) uc
WHERE p.id            = uc.user_id
  AND p.company_id    IS NULL;

-- 2. Verificar resultado
SELECT
  p.email,
  p.role,
  p.company_id,
  c.name AS company_name,
  uc.role AS uc_role
FROM public.profiles p
LEFT JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_companies uc
  ON uc.user_id = p.id AND uc.company_id = p.company_id
WHERE p.company_id IS NOT NULL
ORDER BY p.email;

-- Mostrar usuarios que SIGUEN sin company (necesitan asignación manual)
SELECT
  p.email,
  p.role,
  'SIN EMPRESA — asignar manualmente' AS warning
FROM public.profiles p
WHERE p.company_id IS NULL
  AND p.is_active = true
ORDER BY p.email;

SELECT 'fix_profile_company_backfill OK' AS status;
