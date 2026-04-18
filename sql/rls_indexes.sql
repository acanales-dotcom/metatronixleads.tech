-- ============================================================
-- METATRONIX — Índices para Row Level Security (RLS)
-- Proyecto Supabase: hodrfonbpmqulkyzrzpq
-- ============================================================
-- SIN estos índices, cada query con RLS hace un sequential scan.
-- Con 10K+ rows esto puede significar 100x de degradación.
--
-- INSTRUCCIONES:
--   1. Ve a https://supabase.com/dashboard/project/hodrfonbpmqulkyzrzpq/sql
--   2. Pega este script COMPLETO en el editor SQL
--   3. Haz clic en "Run"
-- ============================================================

-- ── TABLA: leads ────────────────────────────────────────────
-- La policy "leads_select_own" filtra por auth.uid() = user_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_user_id
  ON public.leads(user_id);

-- Índice para ordenamiento por fecha (más frecuente en listados)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_at
  ON public.leads(created_at DESC);

-- Índice compuesto para filtros por status + user_id (Pipeline view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_user_status
  ON public.leads(user_id, status)
  WHERE status IS NOT NULL;

-- ── TABLA: documents ────────────────────────────────────────
-- La policy "docs_select_own" filtra por auth.uid() = user_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_user_id
  ON public.documents(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_created_at
  ON public.documents(created_at DESC);

-- ── TABLA: activity_logs ────────────────────────────────────
-- La policy "logs_select_own" filtra por auth.uid() = user_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_user_id
  ON public.activity_logs(user_id);

-- Índice para el tab Consultas IA (filtra por action LIKE 'frontend_%')
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_action
  ON public.activity_logs(action)
  WHERE action IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs(created_at DESC);

-- ── TABLA: alerts ────────────────────────────────────────────
-- La policy "alerts_select" filtra por auth.uid() = sender_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_sender_id
  ON public.alerts(sender_id);

-- ── TABLA: profiles ──────────────────────────────────────────
-- La policy "profiles_select_own" filtra por auth.uid() = id
-- (id ya es PK, así que ya tiene índice — esto es solo documentación)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- ── FUNCIÓN get_my_role() — Optimización ─────────────────────
-- La función actual hace SELECT role FROM profiles WHERE id = auth.uid()
-- en CADA evaluación de RLS. Mejor práctica: cache del role en JWT.
-- Por ahora solo aseguramos que el índice en profiles(id) esté activo.

-- ── VERIFICACIÓN ─────────────────────────────────────────────
-- Ejecutar para confirmar que los índices existen:
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('leads','documents','activity_logs','alerts','profiles')
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- ── ESTADÍSTICAS ─────────────────────────────────────────────
-- Forzar actualización de stats para que el planner use los índices:
ANALYZE public.leads;
ANALYZE public.documents;
ANALYZE public.activity_logs;
ANALYZE public.alerts;
ANALYZE public.profiles;
