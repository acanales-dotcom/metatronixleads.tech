-- ============================================================
-- SELF-SIGNUP v1 — Registro autónomo de empresa nueva
-- Permite que un usuario recién registrado cree su propia empresa
-- y quede aislado del resto de empresas del portal.
--
-- Requisitos:
--   • rls_hardened_v3.sql ejecutado (user_companies, profiles con RLS)
--   • companies tabla existente (schema de empresas.html)
--
-- Instalación: ejecutar una sola vez en Supabase SQL Editor
-- ============================================================

-- ── 1. Función principal de registro ──────────────────────────
-- Crea empresa + membresía + actualiza perfil en una transacción.
-- SECURITY DEFINER para bypasear RLS de companies.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION self_register_company(
  p_company_name  TEXT,
  p_slug          TEXT,
  p_full_name     TEXT    DEFAULT NULL,
  p_rfc           TEXT    DEFAULT NULL,
  p_industry      TEXT    DEFAULT NULL,
  p_team_size     TEXT    DEFAULT NULL
) RETURNS TABLE (company_id UUID, company_name TEXT, slug TEXT) AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_cid    UUID;
  v_slug   TEXT;
BEGIN
  -- 0. Validar autenticación
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado — requiere sesión activa';
  END IF;

  -- 1. Validar campos obligatorios
  IF trim(p_company_name) = '' OR p_company_name IS NULL THEN
    RAISE EXCEPTION 'El nombre de la empresa es obligatorio';
  END IF;

  -- 2. Generar slug seguro
  v_slug := lower(trim(coalesce(p_slug, p_company_name)));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '^-|-$', '', 'g');
  IF v_slug = '' THEN v_slug := 'empresa'; END IF;

  -- Asegurar slug único agregando sufijo si ya existe
  WHILE EXISTS (SELECT 1 FROM companies WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  END LOOP;

  -- 3. Verificar que el usuario no tenga ya una empresa activa
  IF EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Este usuario ya pertenece a una empresa — usa el portal para acceder';
  END IF;

  -- 4. Crear empresa
  INSERT INTO companies (name, slug, rfc, status, created_at)
  VALUES (
    trim(p_company_name),
    v_slug,
    NULLIF(trim(upper(coalesce(p_rfc,''))), ''),
    'activo',
    now()
  )
  RETURNING id INTO v_cid;

  -- 5. Actualizar perfil con company_id y metadatos de onboarding
  UPDATE profiles SET
    company_id  = v_cid,
    full_name   = CASE WHEN trim(coalesce(p_full_name,'')) <> '' THEN trim(p_full_name) ELSE full_name END,
    role        = 'admin',
    is_active   = true,
    updated_at  = now()
  WHERE id = v_uid;

  -- 6. Crear membresía admin en user_companies
  INSERT INTO user_companies (user_id, company_id, role, created_at)
  VALUES (v_uid, v_cid, 'admin', now())
  ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'admin';

  -- 7. Log de actividad (opcional — no falla si la tabla no existe)
  BEGIN
    INSERT INTO activity_logs (user_id, company_id, action, entity_type, metadata, created_at)
    VALUES (
      v_uid, v_cid, 'empresa_registrada', 'onboarding',
      jsonb_build_object(
        'empresa',    p_company_name,
        'industry',   p_industry,
        'team_size',  p_team_size,
        'fuente',     'self_signup_v1'
      ),
      now()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 8. Retornar datos de la empresa creada
  RETURN QUERY SELECT v_cid, trim(p_company_name), v_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Permisos: solo usuarios autenticados pueden llamar esta función
REVOKE ALL   ON FUNCTION self_register_company FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION self_register_company TO authenticated;

-- ── 2. Índice de soporte si no existe ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_companies_uid ON user_companies(user_id);

-- ── 3. Verificación ───────────────────────────────────────────
SELECT 'self_signup_v1 OK — función self_register_company instalada' AS status;
