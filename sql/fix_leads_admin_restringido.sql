-- ============================================================
-- FIX: admin_restringido puede crear y ver leads propios
-- Problema: is_sales_member_only() no incluía admin_restringido
-- como rol privilegiado, bloqueando INSERT en la tabla leads.
-- ============================================================

-- 1. Actualizar función RLS para reconocer admin_restringido
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

-- 2. Actualizar user_companies: member → admin_restringido para directores de ventas
-- (jorge, noe, rsuarez, clopez — se identifican por profiles.role = admin_restringido)
UPDATE public.user_companies uc
SET role = 'admin_restringido'
WHERE uc.role = 'member'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uc.user_id
      AND p.role = 'admin_restringido'
  );

-- Verificar resultado
SELECT
  p.email,
  p.role AS profile_role,
  uc.role AS company_role,
  c.slug AS company
FROM public.user_companies uc
JOIN public.profiles p ON p.id = uc.user_id
JOIN public.companies c ON c.id = uc.company_id
WHERE p.role = 'admin_restringido'
ORDER BY p.email, c.slug;
