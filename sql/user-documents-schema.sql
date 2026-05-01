-- ═══════════════════════════════════════════════════════════════
-- user-documents-schema.sql
-- Portal de Documentos de Usuario — MetaTronix Multi-tenant
-- Control de acceso granular por supervisor / empresa
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Agregar supervisor_id a profiles ──────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_supervisor ON profiles(supervisor_id);

-- ── 2. Tabla user_documents ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_documents (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id     UUID NOT NULL,
  lead_id        UUID REFERENCES leads(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  filename       TEXT NOT NULL,
  file_type      TEXT DEFAULT 'application/octet-stream',
  file_size      BIGINT DEFAULT 0,
  file_data      TEXT,          -- base64 encoded (same pattern as metatronix_docs)
  text_content   TEXT,          -- extracted text for search / AI
  ai_category    TEXT CHECK (ai_category IN ('ventas','marketing','administracion','operaciones','otro')),
  ai_notes       TEXT,
  ai_reviewed    BOOLEAN DEFAULT FALSE,
  uploaded_by_name TEXT,
  uploaded_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Habilitar RLS ─────────────────────────────────────────────
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- ── 4. Eliminar políticas anteriores (idempotente) ───────────────
DROP POLICY IF EXISTS "user_docs_select_own"        ON user_documents;
DROP POLICY IF EXISTS "user_docs_select_supervisor"  ON user_documents;
DROP POLICY IF EXISTS "user_docs_select_admin"       ON user_documents;
DROP POLICY IF EXISTS "user_docs_insert"             ON user_documents;
DROP POLICY IF EXISTS "user_docs_update_own"         ON user_documents;
DROP POLICY IF EXISTS "user_docs_delete"             ON user_documents;

-- ── 5. Políticas RLS ─────────────────────────────────────────────

-- Cada usuario ve sus propios documentos
CREATE POLICY "user_docs_select_own" ON user_documents
  FOR SELECT USING (user_id = auth.uid());

-- Supervisor directo ve los documentos de su equipo
-- admin_restringido sólo ve lo de SU gente (via supervisor_id)
-- NO puede ver documentos de usuarios bajo otro admin_restringido
CREATE POLICY "user_docs_select_supervisor" ON user_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_documents.user_id
        AND p.supervisor_id = auth.uid()
    )
  );

-- admin y super_admin ven TODOS los docs de su empresa
-- admin_restringido NO está aquí → no puede ver docs de toda la empresa
CREATE POLICY "user_docs_select_admin" ON user_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.company_id = user_documents.company_id
    )
  );

-- El usuario inserta sólo sus propios docs en su empresa
CREATE POLICY "user_docs_insert" ON user_documents
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
      OR
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- El usuario actualiza sólo sus propios docs
CREATE POLICY "user_docs_update_own" ON user_documents
  FOR UPDATE USING (user_id = auth.uid());

-- El usuario elimina sus propios docs; admin puede eliminar docs de su empresa
CREATE POLICY "user_docs_delete" ON user_documents
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.company_id = user_documents.company_id
    )
  );

-- ── 6. Índices de rendimiento ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_docs_user      ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_docs_company   ON user_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_user_docs_lead      ON user_documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_user_docs_ai_pending ON user_documents(ai_reviewed)
  WHERE ai_reviewed = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_docs_category  ON user_documents(ai_category);
CREATE INDEX IF NOT EXISTS idx_user_docs_uploaded  ON user_documents(uploaded_at DESC);
