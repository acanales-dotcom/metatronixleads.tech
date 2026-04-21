-- ============================================================
-- ELIMINAR STARKE COMPLETAMENTE
-- Ejecutar en: Supabase SQL Editor
-- Empresa a eliminar: Starke (b0000000-0000-0000-0000-000000000001)
-- ============================================================

-- 1. Eliminar datos operativos de Starke (si existen)
DELETE FROM leads          WHERE company_id = 'b0000000-0000-0000-0000-000000000001';
DELETE FROM documents      WHERE company_id = 'b0000000-0000-0000-0000-000000000001';
DELETE FROM metatronix_docs WHERE company_id = 'b0000000-0000-0000-0000-000000000001';
DELETE FROM attachments    WHERE company_id = 'b0000000-0000-0000-0000-000000000001';
DELETE FROM org_pulse      WHERE company_id = 'b0000000-0000-0000-0000-000000000001';
DELETE FROM executive_decisions WHERE company_id = 'b0000000-0000-0000-0000-000000000001';

-- 2. Eliminar membresías de todos los usuarios a Starke
DELETE FROM user_companies
WHERE company_id = 'b0000000-0000-0000-0000-000000000001';

-- 3. Eliminar la empresa Starke
DELETE FROM companies
WHERE id = 'b0000000-0000-0000-0000-000000000001';

-- ============================================================
-- ASIGNAR ALCANCES CORRECTOS (3 empresas restantes)
-- MetaTronix  → c0000000-0000-0000-0000-000000000001
-- IBANOR      → a0000000-0000-0000-0000-000000000001
-- Nexus       → d0000000-0000-0000-0000-000000000001
-- ============================================================

-- acanales: super_admin → ve todo automáticamente (sin user_companies)
UPDATE profiles SET role = 'super_admin'
WHERE email = 'acanales@ibanormexico.com';

-- ncanales: super_admin → ve todo automáticamente
UPDATE profiles SET role = 'super_admin'
WHERE email = 'ncanales@ibanormexico.com';

-- nibarra: admin → MetaTronix + IBANOR + Nexus
UPDATE profiles SET role = 'admin'
WHERE email = 'nibarra@ibanormexico.com';

INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'admin'
FROM profiles p, companies c
WHERE p.email = 'nibarra@ibanormexico.com'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- acanalesf: admin → MetaTronix + IBANOR
UPDATE profiles SET role = 'admin'
WHERE email = 'acanalesf@ibanormexico.com';

INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'admin'
FROM profiles p, companies c
WHERE p.email = 'acanalesf@ibanormexico.com'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- Remover acanalesf de Nexus si existe
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'acanalesf@ibanormexico.com')
  AND company_id = 'd0000000-0000-0000-0000-000000000001';

-- rsuarez: solo IBANOR
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, 'a0000000-0000-0000-0000-000000000001', 'member'
FROM profiles p
WHERE p.email = 'rsuarez@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'member';

DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'rsuarez@ibanormexico.com')
  AND company_id IN (
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  );

-- jorge: MetaTronix + Nexus (director ventas externo)
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'member'
FROM profiles p, companies c
WHERE p.email = 'jorge@retaillab.com.mx'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'member';

DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'jorge@retaillab.com.mx')
  AND company_id = 'a0000000-0000-0000-0000-000000000001';

-- noe: MetaTronix + Nexus
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'member'
FROM profiles p, companies c
WHERE p.email = 'noe@grupoamsg.com'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'member';

DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'noe@grupoamsg.com')
  AND company_id = 'a0000000-0000-0000-0000-000000000001';

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT
  p.email,
  p.role,
  COALESCE(STRING_AGG(c.name, ' | ' ORDER BY c.name), '(solo super_admin)') AS empresas
FROM profiles p
LEFT JOIN user_companies uc ON uc.user_id = p.id
LEFT JOIN companies c ON c.id = uc.company_id
WHERE p.email IN (
  'acanales@ibanormexico.com',
  'ncanales@ibanormexico.com',
  'nibarra@ibanormexico.com',
  'acanalesf@ibanormexico.com',
  'rsuarez@ibanormexico.com',
  'jorge@retaillab.com.mx',
  'noe@grupoamsg.com'
)
GROUP BY p.email, p.role
ORDER BY p.role DESC, p.email;
