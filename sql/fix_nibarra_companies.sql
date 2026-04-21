-- ============================================================
-- FIX: nibarra — Alcances de empresa correctos
-- nibarra debe ver SOLO: MetaTronix, IBANOR, Nexus
-- NO debe ver: Starke
-- Role: admin (no super_admin)
-- ============================================================

-- 1. Confirmar que nibarra tiene role = admin (no super_admin)
--    super_admin es exclusivo para CEOs (acanales, ncanales)
UPDATE profiles
SET role = 'admin'
WHERE email = 'nibarra@ibanormexico.com'
  AND role = 'super_admin';  -- solo cambia si aún es super_admin

-- 2. Asegurarse que nibarra está en MetaTronix
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, 'c0000000-0000-0000-0000-000000000001', 'admin'
FROM profiles p
WHERE p.email = 'nibarra@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- 3. Asegurarse que nibarra está en IBANOR
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, 'a0000000-0000-0000-0000-000000000001', 'admin'
FROM profiles p
WHERE p.email = 'nibarra@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- 4. Asegurarse que nibarra está en Nexus
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, 'd0000000-0000-0000-0000-000000000001', 'admin'
FROM profiles p
WHERE p.email = 'nibarra@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- 5. REMOVER nibarra de Starke (no debe tener acceso)
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'nibarra@ibanormexico.com')
  AND company_id = 'b0000000-0000-0000-0000-000000000001';

-- ============================================================
-- VERIFICACIÓN — Resultado esperado para nibarra:
--   role: admin
--   empresas: IBANOR SA de CV, MetaTronix, Grupo Nexus SA de CV
-- ============================================================
SELECT
  p.email,
  p.role,
  p.company_id AS company_primaria,
  STRING_AGG(c.name || ' [' || uc.role || ']', ', ' ORDER BY c.name) AS empresas_asignadas
FROM profiles p
JOIN user_companies uc ON uc.user_id = p.id
JOIN companies c ON c.id = uc.company_id
WHERE p.email = 'nibarra@ibanormexico.com'
GROUP BY p.email, p.role, p.company_id;
