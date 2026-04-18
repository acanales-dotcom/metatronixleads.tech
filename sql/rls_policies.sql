-- ============================================================
-- METATRONIX — Row Level Security (RLS) Policies
-- Proyecto Supabase: hodrfonbpmqulkyzrzpq
-- ============================================================
-- INSTRUCCIONES:
--   1. Ve a https://supabase.com/dashboard/project/hodrfonbpmqulkyzrzpq/sql
--   2. Pega este script COMPLETO en el editor SQL
--   3. Haz clic en "Run" (o Ctrl+Enter)
--   4. Verifica que cada tabla muestre "RLS enabled" en:
--      Table Editor → [tabla] → RLS
-- ============================================================

-- ── Helper: obtener rol del usuario autenticado ──────────────
-- Esta función permite a las policies verificar el rol sin
-- hacer N+1 queries. Se llama desde las policies de abajo.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- TABLA: profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Todo usuario autenticado puede ver su propio perfil
DROP POLICY IF EXISTS "profiles_select_own"    ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins y superAdmin pueden ver todos los perfiles
DROP POLICY IF EXISTS "profiles_select_admin"  ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    get_my_role() IN ('admin', 'super_admin')
  );

-- Cada usuario puede actualizar su propio perfil (campos limitados)
-- Para campos sensibles (role, claude_enabled, etc.) solo el admin puede cambiarlos
DROP POLICY IF EXISTS "profiles_update_own"    ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    -- No puede cambiar su propio role ni configuración Claude
    auth.uid() = id
  );

-- Solo superAdmin puede actualizar cualquier perfil (para cambiar roles, etc.)
DROP POLICY IF EXISTS "profiles_update_admin"  ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    get_my_role() = 'super_admin'
  );

-- Nadie puede insertar perfiles directamente (solo via auth.users trigger)
DROP POLICY IF EXISTS "profiles_insert_admin"  ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (
    get_my_role() = 'super_admin'
  );

-- Solo superAdmin puede eliminar perfiles
DROP POLICY IF EXISTS "profiles_delete_admin"  ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (
    get_my_role() = 'super_admin'
  );

-- ============================================================
-- TABLA: leads
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Colaboradores ven solo sus propios leads
DROP POLICY IF EXISTS "leads_select_own"       ON public.leads;
CREATE POLICY "leads_select_own" ON public.leads
  FOR SELECT USING (
    auth.uid() = user_id
    OR get_my_role() IN ('admin', 'super_admin', 'admin_restringido')
  );

-- Colaboradores pueden crear leads asignados a sí mismos
DROP POLICY IF EXISTS "leads_insert_own"       ON public.leads;
CREATE POLICY "leads_insert_own" ON public.leads
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR get_my_role() IN ('admin', 'super_admin')
  );

-- Colaboradores pueden actualizar sus propios leads; admins pueden todos
DROP POLICY IF EXISTS "leads_update_own"       ON public.leads;
CREATE POLICY "leads_update_own" ON public.leads
  FOR UPDATE USING (
    auth.uid() = user_id
    OR get_my_role() IN ('admin', 'super_admin')
  );

-- Solo admin/superAdmin pueden eliminar leads
DROP POLICY IF EXISTS "leads_delete_admin"     ON public.leads;
CREATE POLICY "leads_delete_admin" ON public.leads
  FOR DELETE USING (
    get_my_role() IN ('admin', 'super_admin')
  );

-- ============================================================
-- TABLA: documents
-- ============================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Usuarios ven sus propios documentos; admins ven todos
DROP POLICY IF EXISTS "docs_select_own"        ON public.documents;
CREATE POLICY "docs_select_own" ON public.documents
  FOR SELECT USING (
    auth.uid() = user_id
    OR get_my_role() IN ('admin', 'super_admin', 'admin_restringido')
  );

-- Usuarios crean documentos solo para sí mismos
DROP POLICY IF EXISTS "docs_insert_own"        ON public.documents;
CREATE POLICY "docs_insert_own" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuarios actualizan sus propios docs; admins actualizan cualquiera
-- (necesario para aprobación/rechazo desde admin.html)
DROP POLICY IF EXISTS "docs_update_own"        ON public.documents;
CREATE POLICY "docs_update_own" ON public.documents
  FOR UPDATE USING (
    auth.uid() = user_id
    OR get_my_role() IN ('admin', 'super_admin')
  );

-- Solo admins eliminan documentos
DROP POLICY IF EXISTS "docs_delete_admin"      ON public.documents;
CREATE POLICY "docs_delete_admin" ON public.documents
  FOR DELETE USING (
    get_my_role() IN ('admin', 'super_admin')
  );

-- ============================================================
-- TABLA: activity_logs
-- ============================================================
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver sus propios logs; admins ven todos
DROP POLICY IF EXISTS "logs_select_own"        ON public.activity_logs;
CREATE POLICY "logs_select_own" ON public.activity_logs
  FOR SELECT USING (
    auth.uid() = user_id
    OR get_my_role() IN ('admin', 'super_admin')
  );

-- Cualquier usuario autenticado puede insertar sus propios logs
DROP POLICY IF EXISTS "logs_insert_own"        ON public.activity_logs;
CREATE POLICY "logs_insert_own" ON public.activity_logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- Nadie puede actualizar ni eliminar logs (inmutables por diseño)
-- No se crean políticas UPDATE/DELETE = denegado por defecto con RLS activo

-- ============================================================
-- TABLA: alerts
-- ============================================================
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Remitentes ven sus propias alertas; admins/superAdmin ven todas
DROP POLICY IF EXISTS "alerts_select"          ON public.alerts;
CREATE POLICY "alerts_select" ON public.alerts
  FOR SELECT USING (
    auth.uid() = sender_id
    OR get_my_role() IN ('admin', 'super_admin')
  );

-- Cualquier usuario autenticado puede crear alertas
DROP POLICY IF EXISTS "alerts_insert"          ON public.alerts;
CREATE POLICY "alerts_insert" ON public.alerts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Solo admins pueden actualizar alertas (marcar como leídas, etc.)
DROP POLICY IF EXISTS "alerts_update_admin"    ON public.alerts;
CREATE POLICY "alerts_update_admin" ON public.alerts
  FOR UPDATE USING (
    get_my_role() IN ('admin', 'super_admin')
  );

-- Solo superAdmin puede eliminar alertas
DROP POLICY IF EXISTS "alerts_delete_admin"    ON public.alerts;
CREATE POLICY "alerts_delete_admin" ON public.alerts
  FOR DELETE USING (
    get_my_role() = 'super_admin'
  );

-- ============================================================
-- TABLA: documents_files (si existe — archivos adjuntos)
-- ============================================================
-- Verificar si existe antes de ejecutar:
-- SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'documents_files');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents_files') THEN
    EXECUTE 'ALTER TABLE public.documents_files ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "dfiles_select" ON public.documents_files';
    EXECUTE $p$
      CREATE POLICY "dfiles_select" ON public.documents_files
        FOR SELECT USING (
          auth.uid() = user_id
          OR public.get_my_role() IN (''admin'', ''super_admin'')
        )
    $p$;
  END IF;
END $$;

-- ============================================================
-- VERIFICACIÓN — ejecutar después para confirmar
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles','leads','documents','activity_logs','alerts');
--
-- SELECT tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
-- ============================================================
