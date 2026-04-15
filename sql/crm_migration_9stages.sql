-- ============================================================
-- MetaTronix CRM — Migración Pipeline 9 Etapas
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Ampliar CHECK constraint de status para aceptar las 9 etapas nuevas
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (
  status IN (
    -- Nuevas 9 etapas
    'generacion', 'primer_contacto', 'calificacion', 'propuesta',
    'negociacion', 'cierre', 'postventa', 'retencion', 'fidelizacion',
    -- Backward compat (etapas antiguas)
    'nuevo', 'contactado', 'en_negociacion', 'propuesta_enviada',
    'cerrado_ganado', 'cerrado_perdido'
  )
);

-- 2. Agregar nuevas columnas al objeto Lead
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS campana              TEXT,
  ADD COLUMN IF NOT EXISTS ciudad               TEXT,
  ADD COLUMN IF NOT EXISTS competidores_zona    TEXT,
  ADD COLUMN IF NOT EXISTS canal_contacto       TEXT DEFAULT 'otro',
  ADD COLUMN IF NOT EXISTS asignado_a           UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS asignado_nombre      TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_stage       TEXT DEFAULT 'generacion',
  ADD COLUMN IF NOT EXISTS sentiment_score      TEXT DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS lat                  DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS lng                  DECIMAL(9,6);

-- 3. RLS: leads table policies (if missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='own_leads_all') THEN
    CREATE POLICY "own_leads_all" ON leads FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='admin_leads_all') THEN
    CREATE POLICY "admin_leads_all" ON leads FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('admin','super_admin','admin_restringido'))
    );
  END IF;
END $$;

-- 4. Migrar leads existentes: llenar pipeline_stage desde status
UPDATE leads SET pipeline_stage = CASE
  WHEN status = 'nuevo'             THEN 'generacion'
  WHEN status = 'contactado'        THEN 'primer_contacto'
  WHEN status = 'en_negociacion'    THEN 'negociacion'
  WHEN status = 'propuesta_enviada' THEN 'propuesta'
  WHEN status = 'cerrado_ganado'    THEN 'cierre'
  WHEN status = 'cerrado_perdido'   THEN 'cerrado_perdido'
  ELSE status
END
WHERE pipeline_stage IS NULL OR pipeline_stage = 'generacion';

-- 5. Verificar
SELECT
  COUNT(*) as total_leads,
  COUNT(DISTINCT pipeline_stage) as etapas_distintas,
  COUNT(CASE WHEN campana IS NOT NULL THEN 1 END) as con_campana,
  COUNT(CASE WHEN ciudad IS NOT NULL THEN 1 END) as con_ciudad
FROM leads;
