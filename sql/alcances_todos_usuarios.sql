-- ============================================================
-- ALCANCES DE EMPRESA — Todos los usuarios
-- Ejecutar en Supabase SQL Editor para verificar y corregir
--
-- EMPRESAS:
--   MetaTronix  → c0000000-0000-0000-0000-000000000001
--   IBANOR      → a0000000-0000-0000-0000-000000000001
--   Starke      → b0000000-0000-0000-0000-000000000001
--   Nexus       → d0000000-0000-0000-0000-000000000001
--
-- ALCANCES REQUERIDOS:
--   acanales   (super_admin) → VE TODAS (sin restricción)
--   ncanales   (super_admin) → VE TODAS (sin restricción)
--   nibarra    (admin)       → MetaTronix, IBANOR, Nexus  (NO Starke)
--   acanalesf  (admin)       → MetaTronix, IBANOR         (no Nexus, no Starke)
--   rsuarez    (admin)       → IBANOR                     (solo su empresa)
--   jorge      (admin_restringido) → MetaTronix, Nexus    (ventas externos)
--   noe        (admin_restringido) → MetaTronix, Nexus    (ventas externos)
-- ============================================================

-- ── NIBARRA ────────────────────────────────────────────────
UPDATE profiles SET role = 'admin'
WHERE email = 'nibarra@ibanormexico.com';

-- MetaTronix ✅
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'c0000000-0000-0000-0000-000000000001', 'admin'
FROM profiles WHERE email = 'nibarra@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- IBANOR ✅
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'a0000000-0000-0000-0000-000000000001', 'admin'
FROM profiles WHERE email = 'nibarra@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- Nexus ✅
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'd0000000-0000-0000-0000-000000000001', 'admin'
FROM profiles WHERE email = 'nibarra@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- Starke ❌ (remover)
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'nibarra@ibanormexico.com')
  AND company_id = 'b0000000-0000-0000-0000-000000000001';


-- ── ACANALESF ─────────────────────────────────────────────
UPDATE profiles SET role = 'admin'
WHERE email = 'acanalesf@ibanormexico.com';

-- MetaTronix ✅
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'c0000000-0000-0000-0000-000000000001', 'admin'
FROM profiles WHERE email = 'acanalesf@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- IBANOR ✅
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'a0000000-0000-0000-0000-000000000001', 'admin'
FROM profiles WHERE email = 'acanalesf@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

-- Nexus ❌ (remover si existe)
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'acanalesf@ibanormexico.com')
  AND company_id = 'd0000000-0000-0000-0000-000000000001';

-- Starke ❌ (remover si existe)
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'acanalesf@ibanormexico.com')
  AND company_id = 'b0000000-0000-0000-0000-000000000001';


-- ── RSUAREZ ───────────────────────────────────────────────
-- Solo IBANOR ✅
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'a0000000-0000-0000-0000-000000000001', 'member'
FROM profiles WHERE email = 'rsuarez@ibanormexico.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'member';

-- MetaTronix ❌
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'rsuarez@ibanormexico.com')
  AND company_id = 'c0000000-0000-0000-0000-000000000001';

-- Starke ❌
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'rsuarez@ibanormexico.com')
  AND company_id = 'b0000000-0000-0000-0000-000000000001';

-- Nexus ❌
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'rsuarez@ibanormexico.com')
  AND company_id = 'd0000000-0000-0000-0000-000000000001';


-- ── JORGE ─────────────────────────────────────────────────
-- MetaTronix ✅ + Nexus ✅ (es director de ventas externo)
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'c0000000-0000-0000-0000-000000000001', 'member'
FROM profiles WHERE email = 'jorge@retaillab.com.mx'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'member';

INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'd0000000-0000-0000-0000-000000000001', 'member'
FROM profiles WHERE email = 'jorge@retaillab.com.mx'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'member';

-- IBANOR ❌ + Starke ❌
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'jorge@retaillab.com.mx')
  AND company_id IN (
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001'
  );


-- ── NOE ───────────────────────────────────────────────────
-- MetaTronix ✅ + Nexus ✅
INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'c0000000-0000-0000-0000-000000000001', 'member'
FROM profiles WHERE email = 'noe@grupoamsg.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'member';

INSERT INTO user_companies (user_id, company_id, role)
SELECT id, 'd0000000-0000-0000-0000-000000000001', 'member'
FROM profiles WHERE email = 'noe@grupoamsg.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'member';

-- IBANOR ❌ + Starke ❌
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'noe@grupoamsg.com')
  AND company_id IN (
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001'
  );


-- ── VERIFICACIÓN FINAL ─────────────────────────────────────
SELECT
  p.email,
  p.role,
  COALESCE(STRING_AGG(c.name, ', ' ORDER BY c.name), '(sin empresas)') AS empresas_asignadas
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
ORDER BY p.role, p.email;
