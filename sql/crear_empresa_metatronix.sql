-- ============================================================
-- METATRONIX — Empresa + 6 usuarios
-- Ejecutar en: Supabase SQL Editor
-- Contraseña temporal para todos: Metatronix2026!
-- ============================================================

DO $$
DECLARE
  -- UUIDs para la empresa
  company_uuid   UUID := 'c0000000-0000-0000-0000-000000000001';

  -- UUIDs de usuarios (se llenan dinámicamente)
  uid_acanales   UUID;
  uid_ncanales   UUID;
  uid_nibarra    UUID;
  uid_acanalesf  UUID;
  uid_jorge      UUID;
  uid_noe        UUID;

  PASS TEXT := 'Metatronix2026!';

  -- Helper para crear o recuperar usuario
  FUNCTION get_or_create_user(p_email TEXT, p_name TEXT, p_pass TEXT)
  RETURNS UUID LANGUAGE plpgsql AS $fn$
  DECLARE v_id UUID;
  BEGIN
    SELECT id INTO v_id FROM auth.users WHERE email = lower(p_email);
    IF v_id IS NULL THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(), 'authenticated', 'authenticated',
        lower(p_email),
        crypt(p_pass, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        ('{"full_name":"' || p_name || '"}')::jsonb,
        NOW(), NOW(), '', ''
      ) RETURNING id INTO v_id;
      RAISE NOTICE 'Creado: % → %', p_email, v_id;
    ELSE
      RAISE NOTICE 'Ya existe: % → %', p_email, v_id;
    END IF;
    RETURN v_id;
  END $fn$;

BEGIN

  -- ── 1. EMPRESA METATRONIX ──────────────────────────────────

  INSERT INTO companies (id, slug, name, rfc, status)
  VALUES (company_uuid, 'metatronix', 'MetaTronix', 'MTX000000AA1', 'activo')
  ON CONFLICT (id) DO UPDATE SET name = 'MetaTronix', status = 'activo';

  -- También insertar en el esquema slug-based
  INSERT INTO companies (id, name, owner_email, plan, is_active)
  VALUES ('metatronix', 'MetaTronix', 'acanales@ibanormexico.com', 'enterprise', true)
  ON CONFLICT (id) DO UPDATE SET name = 'MetaTronix', plan = 'enterprise', is_active = true;

  -- ── 2. CREAR USUARIOS ─────────────────────────────────────

  uid_acanales  := get_or_create_user('acanales@ibanormexico.com',  'A. Canales',    PASS);
  uid_ncanales  := get_or_create_user('ncanales@ibanormexico.com',  'N. Canales',    PASS);
  uid_nibarra   := get_or_create_user('nibarra@ibanormexico.com',   'N. Ibarra',     PASS);
  uid_acanalesf := get_or_create_user('acanalesf@ibanormexico.com', 'A. Canales F.', PASS);
  uid_jorge     := get_or_create_user('jorge@retaillab.com.mx',     'Jorge',         PASS);
  uid_noe       := get_or_create_user('Noe@grupoamsg.com',          'Noé',           PASS);

  -- ── 3. PROFILES ───────────────────────────────────────────

  INSERT INTO public.profiles (id, email, role, company_id, full_name, department, job_title, consejo_limit, created_at)
  VALUES
    -- CEOs → super_admin
    (uid_acanales,  'acanales@ibanormexico.com',  'super_admin',      'metatronix', 'A. Canales',    'direccion', 'CEO',                         9999, NOW()),
    (uid_ncanales,  'ncanales@ibanormexico.com',  'super_admin',      'metatronix', 'N. Canales',    'direccion', 'CEO',                         9999, NOW()),
    -- Directores Admin/Finanzas → admin
    (uid_nibarra,   'nibarra@ibanormexico.com',   'admin',            'metatronix', 'N. Ibarra',     'finanzas',  'Director Admin y Finanzas',   200,  NOW()),
    (uid_acanalesf, 'acanalesf@ibanormexico.com', 'admin',            'metatronix', 'A. Canales F.', 'finanzas',  'Director Admin y Finanzas',   200,  NOW()),
    -- Directores de Ventas → admin_restringido + department=ventas (sin acceso a finanzas/admin)
    (uid_jorge,     'jorge@retaillab.com.mx',     'admin_restringido','metatronix', 'Jorge',         'ventas',    'Director de Ventas',          100,  NOW()),
    (uid_noe,       'noe@grupoamsg.com',          'admin_restringido','metatronix', 'Noé',           'ventas',    'Director de Ventas',          100,  NOW())
  ON CONFLICT (id) DO UPDATE SET
    role        = EXCLUDED.role,
    company_id  = EXCLUDED.company_id,
    department  = EXCLUDED.department,
    job_title   = EXCLUDED.job_title,
    consejo_limit = EXCLUDED.consejo_limit;

  -- ── 4. MEMBRESÍAS EN user_companies ───────────────────────

  INSERT INTO user_companies (user_id, company_id, role)
  VALUES
    (uid_acanales,  company_uuid, 'owner'),
    (uid_ncanales,  company_uuid, 'owner'),
    (uid_nibarra,   company_uuid, 'admin'),
    (uid_acanalesf, company_uuid, 'admin'),
    (uid_jorge,     company_uuid, 'member'),
    (uid_noe,       company_uuid, 'member')
  ON CONFLICT (user_id, company_id) DO UPDATE SET role = EXCLUDED.role;

  RAISE NOTICE '✅ METATRONIX creada con 6 usuarios. Contraseña: Metatronix2026!';

END $$;

-- ── VERIFICACIÓN ───────────────────────────────────────────
SELECT
  u.email,
  p.role,
  p.department,
  p.job_title,
  p.company_id,
  u.email_confirmed_at IS NOT NULL AS confirmado
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email IN (
  'acanales@ibanormexico.com',
  'ncanales@ibanormexico.com',
  'nibarra@ibanormexico.com',
  'acanalesf@ibanormexico.com',
  'jorge@retaillab.com.mx',
  'noe@grupoamsg.com'
)
ORDER BY p.role, u.email;
