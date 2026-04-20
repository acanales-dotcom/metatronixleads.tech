-- ============================================================
-- ADJUNTOS DE REGISTROS — MetaTronix
-- Crea: record_attachments + bucket "docs" en Supabase Storage
-- Aislamiento por company_id (Starke / IBANOR / etc. separados)
-- ============================================================

-- 1. Tabla de metadatos de adjuntos
CREATE TABLE IF NOT EXISTS record_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  record_type   TEXT NOT NULL CHECK (record_type IN (
                  'invoice_out','invoice_in','lead','requisition',
                  'purchase_order','general')),
  record_id     UUID,           -- NULL para documentos generales
  record_label  TEXT,           -- nombre descriptivo del registro
  file_name     TEXT NOT NULL,
  file_size     INTEGER,        -- bytes
  mime_type     TEXT,
  storage_path  TEXT NOT NULL,  -- ruta en Supabase Storage
  uploaded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE record_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attach_select" ON record_attachments;
DROP POLICY IF EXISTS "attach_insert" ON record_attachments;
DROP POLICY IF EXISTS "attach_delete" ON record_attachments;

CREATE POLICY "attach_select" ON record_attachments FOR SELECT
  USING (user_has_company_access(company_id));
CREATE POLICY "attach_insert" ON record_attachments FOR INSERT
  WITH CHECK (user_has_company_access(company_id));
CREATE POLICY "attach_delete" ON record_attachments FOR DELETE
  USING (user_has_company_access(company_id));

CREATE INDEX IF NOT EXISTS idx_attach_company    ON record_attachments(company_id);
CREATE INDEX IF NOT EXISTS idx_attach_record     ON record_attachments(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_attach_created    ON record_attachments(created_at DESC);

-- 2. Bucket de Storage "docs" (privado, máx 50MB por archivo)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('docs', 'docs', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS en storage.objects — aislamiento por company_id (primer segmento del path)
DROP POLICY IF EXISTS "docs_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "docs_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "docs_storage_delete" ON storage.objects;

CREATE POLICY "docs_storage_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'docs' AND
    user_has_company_access((string_to_array(name, '/'))[1]::UUID)
  );

CREATE POLICY "docs_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'docs' AND
    user_has_company_access((string_to_array(name, '/'))[1]::UUID)
  );

CREATE POLICY "docs_storage_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'docs' AND
    user_has_company_access((string_to_array(name, '/'))[1]::UUID)
  );

SELECT 'Attachments setup completado' AS resultado;
