-- ============================================================
-- MIGRACIÓN: Agregar módulo de Leads
-- Ejecutar en Supabase Dashboard → SQL Editor
-- (Solo si ya tienes setup.sql aplicado)
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  empresa           TEXT NOT NULL,
  contacto_nombre   TEXT,
  contacto_email    TEXT,
  contacto_telefono TEXT,
  cargo             TEXT,
  fuente            TEXT DEFAULT 'otro'
                    CHECK (fuente IN ('referido','web','evento','llamada','linkedin','otro')),
  status            TEXT NOT NULL DEFAULT 'nuevo'
                    CHECK (status IN ('nuevo','contactado','en_negociacion','propuesta_enviada','cerrado_ganado','cerrado_perdido')),
  valor_estimado    NUMERIC(12,2),
  moneda            TEXT DEFAULT 'MXN',
  notas             TEXT,
  seguimiento       DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_leads_all"   ON leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "admin_leads_all" ON leads FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
