-- ============================================================
-- ACCESOS DEFINITIVOS POR USUARIO
-- Ejecutar en: Supabase SQL Editor
--
-- acanales   → super_admin (ve todo, dueño de plataforma)
-- ncanales   → admin: MetaTronix + Nexus
-- nibarra    → admin: MetaTronix + IBANOR
-- acanalesf  → admin: MetaTronix + IBANOR
-- rsuarez    → admin: MetaTronix + Nexus
-- jorge      → admin_restringido: MetaTronix + Nexus
-- noe        → admin_restringido: MetaTronix + Nexus
--
-- UUIDs:
--   MetaTronix  c0000000-0000-0000-0000-000000000001
--   IBANOR      a0000000-0000-0000-0000-000000000001
--   Nexus       d0000000-0000-0000-0000-000000000001
-- ============================================================

-- ── 1. ROLES ──────────────────────────────────────────────────
UPDATE profiles SET role = 'super_admin' WHERE email = 'acanales@ibanormexico.com';
UPDATE profiles SET role = 'admin'       WHERE email = 'ncanales@ibanormexico.com';
UPDATE profiles SET role = 'admin'       WHERE email = 'nibarra@ibanormexico.com';
UPDATE profiles SET role = 'admin'       WHERE email = 'acanalesf@ibanormexico.com';
UPDATE profiles SET role = 'admin'       WHERE email = 'rsuarez@ibanormexico.com';
UPDATE profiles SET role = 'admin_restringido' WHERE email = 'jorge@retaillab.com.mx';
UPDATE profiles SET role = 'admin_restringido' WHERE email = 'noe@grupoamsg.com';

-- ── 2. LIMPIAR user_companies (reset limpio) ─────────────────
DELETE FROM user_companies
WHERE user_id IN (
  SELECT id FROM profiles WHERE email IN (
    'ncanales@ibanormexico.com',
    'nibarra@ibanormexico.com',
    'acanalesf@ibanormexico.com',
    'rsuarez@ibanormexico.com',
    'jorge@retaillab.com.mx',
    'noe@grupoamsg.com'
  )
);

-- ── 3. ASIGNAR EMPRESAS ───────────────────────────────────────

-- ncanales → MetaTronix + Nexus
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'admin'
FROM profiles p, companies c
WHERE p.email = 'ncanales@ibanormexico.com'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  );

-- nibarra → MetaTronix + IBANOR
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'admin'
FROM profiles p, companies c
WHERE p.email = 'nibarra@ibanormexico.com'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
  );

-- acanalesf → MetaTronix + IBANOR
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'admin'
FROM profiles p, companies c
WHERE p.email = 'acanalesf@ibanormexico.com'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
  );

-- rsuarez → MetaTronix + Nexus
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'member'
FROM profiles p, companies c
WHERE p.email = 'rsuarez@ibanormexico.com'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  );

-- jorge → MetaTronix + Nexus
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'member'
FROM profiles p, companies c
WHERE p.email = 'jorge@retaillab.com.mx'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  );

-- noe → MetaTronix + Nexus
INSERT INTO user_companies (user_id, company_id, role)
SELECT p.id, c.id, 'member'
FROM profiles p, companies c
WHERE p.email = 'noe@grupoamsg.com'
  AND c.id IN (
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001'
  );

-- ── VERIFICACIÓN ──────────────────────────────────────────────
SELECT
  p.email,
  p.role,
  COALESCE(STRING_AGG(c.name, ' | ' ORDER BY c.name), '(super_admin — ve todo)') AS empresas
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
