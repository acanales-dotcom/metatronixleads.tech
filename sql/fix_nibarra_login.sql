-- ============================================================
-- DIAGNÓSTICO + FIX LOGIN nibarra@ibanormexico.com
-- Pega este script COMPLETO en:
-- https://supabase.com/dashboard/project/hodrfonbpmqulkyzrzpq/sql
-- ============================================================

-- ── 1. DIAGNÓSTICO: Ver estado actual ─────────────────────────
SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL         AS email_confirmado,
  u.banned_until IS NOT NULL               AS baneado,
  u.banned_until,
  u.created_at,
  u.last_sign_in_at,
  p.role,
  p.company_id,
  p.full_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'nibarra@ibanormexico.com';

-- ── 2. FIX: Confirmar email + desbanear + resetear contraseña ─
UPDATE auth.users
SET
  email_confirmed_at = NOW(),
  encrypted_password = crypt('Ibanor2026!', gen_salt('bf')),
  banned_until       = NULL,
  updated_at         = NOW()
WHERE email = 'nibarra@ibanormexico.com';

-- ── 3. FIX: Asegurar que el profile existe y tiene rol correcto
INSERT INTO public.profiles (id, email, role, company_id, full_name, consejo_limit, created_at)
SELECT
  u.id,
  'nibarra@ibanormexico.com',
  'super_admin',
  'ibanor',
  'N. Ibarra',
  9999,
  NOW()
FROM auth.users u
WHERE u.email = 'nibarra@ibanormexico.com'
ON CONFLICT (id) DO UPDATE SET
  role          = 'super_admin',
  company_id    = 'ibanor',
  consejo_limit = 9999;

-- ── 4. FIX: Asegurar membresía en empresa IBANOR ──────────────
DO $$
DECLARE
  uid_nibarra  UUID;
  company_uuid UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO uid_nibarra FROM auth.users WHERE email = 'nibarra@ibanormexico.com';
  IF uid_nibarra IS NULL THEN
    RAISE NOTICE 'ERROR: nibarra no existe en auth.users — ejecutar crear_usuarios_ibanor.sql primero';
  ELSE
    INSERT INTO user_companies (user_id, company_id, role)
    VALUES (uid_nibarra, company_uuid, 'admin')
    ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';
    RAISE NOTICE 'OK: nibarra UID = %', uid_nibarra;
  END IF;
END $$;

-- ── 5. VERIFICACIÓN FINAL ──────────────────────────────────────
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL         AS email_ok,
  u.banned_until IS NULL                   AS no_baneado,
  p.role,
  uc.role                                  AS company_role,
  c.name                                   AS empresa
FROM auth.users u
LEFT JOIN public.profiles p      ON p.id = u.id
LEFT JOIN public.user_companies uc ON uc.user_id = u.id
LEFT JOIN public.companies c     ON c.id = uc.company_id
WHERE u.email = 'nibarra@ibanormexico.com';

-- ── Resultado esperado: ────────────────────────────────────────
-- email_ok=true | no_baneado=true | role=super_admin | company_role=admin | empresa=IBANOR SA de CV
