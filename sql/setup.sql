-- ============================================================
-- METATRONIXLEADS.TECH — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. PROFILES (extiende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  full_name    TEXT,
  role         TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_seen    TIMESTAMPTZ
);

-- 2. DOCUMENTOS
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  doc_type     TEXT NOT NULL DEFAULT 'general',
  prompt       TEXT,
  content      TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','pending_review','approved','rejected','archived')),
  word_count   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ACTIVIDAD
CREATE TABLE IF NOT EXISTS activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ALERTAS (revisiones para admin)
CREATE TABLE IF NOT EXISTS alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  sender_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message      TEXT,
  type         TEXT NOT NULL DEFAULT 'review'
               CHECK (type IN ('review','info','warning','urgent')),
  is_read      BOOLEAN DEFAULT FALSE,
  resolved_by  UUID REFERENCES profiles(id),
  resolved_at  TIMESTAMPTZ,
  admin_note   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts        ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "own_profile_select"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_update"   ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin_profiles_all"   ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- DOCUMENTS
CREATE POLICY "own_docs_all"         ON documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_docs_all"       ON documents FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ACTIVITY LOGS
CREATE POLICY "insert_own_log"       ON activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_logs_select"    ON activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ALERTS
CREATE POLICY "user_insert_alert"    ON alerts FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "user_own_alerts"      ON alerts FOR SELECT USING (auth.uid() = sender_id);
CREATE POLICY "admin_alerts_all"     ON alerts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ============================================================
-- TRIGGER: crear perfil automáticamente al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 5. LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  empresa         TEXT NOT NULL,
  contacto_nombre TEXT,
  contacto_email  TEXT,
  contacto_telefono TEXT,
  cargo           TEXT,
  fuente          TEXT DEFAULT 'otro'
                  CHECK (fuente IN ('referido','web','evento','llamada','linkedin','otro')),
  status          TEXT NOT NULL DEFAULT 'nuevo'
                  CHECK (status IN ('nuevo','contactado','en_negociacion','propuesta_enviada','cerrado_ganado','cerrado_perdido')),
  valor_estimado  NUMERIC(12,2),
  moneda          TEXT DEFAULT 'MXN',
  notas           TEXT,
  seguimiento     DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: colaborador ve solo los suyos, admin ve todos
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_leads_all"   ON leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_leads_all" ON leads FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ============================================================
-- REALTIME (para alertas en vivo en admin)
-- ============================================================
-- Habilitar en: Supabase Dashboard → Database → Replication
-- Tablas: alerts, documents, leads
