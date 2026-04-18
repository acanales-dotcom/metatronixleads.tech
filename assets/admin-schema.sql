-- ============================================================
-- METATRONIXLEADS.TECH — Admin Module Schema
-- Módulo: Administración (Finanzas, Cobranza, Compras, Facturación)
-- Ejecutar en: Supabase SQL Editor
-- Requiere: tabla `companies` y `profiles` ya existentes con company_id
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PROVEEDORES (suppliers)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  rfc             TEXT,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  payment_terms   INTEGER DEFAULT 30,   -- días de crédito
  category        TEXT,                  -- 'tecnología','servicios','materiales', etc.
  status          TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','inactivo','bloqueado')),
  rating          NUMERIC(3,2),         -- 0.00 – 5.00
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status  ON suppliers(status);

-- ─────────────────────────────────────────────────────────────
-- 2. REQUISICIONES (requisitions)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requisitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  folio           TEXT NOT NULL,              -- REQ-2026-001
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  amount_estimated NUMERIC(14,2),
  currency        TEXT NOT NULL DEFAULT 'MXN',
  requested_by    UUID REFERENCES auth.users(id),
  requested_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  needed_date     DATE,
  status          TEXT NOT NULL DEFAULT 'borrador'
                  CHECK (status IN ('borrador','pendiente','aprobada','rechazada','cancelada','completada')),
  approved_by     UUID REFERENCES auth.users(id),
  approved_at     TIMESTAMPTZ,
  rejection_note  TEXT,
  purchase_order_id UUID,                     -- FK a purchase_orders (circular, se agrega después)
  attachments     JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requisitions_select" ON requisitions FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "requisitions_insert" ON requisitions FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "requisitions_update" ON requisitions FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_requisitions_company ON requisitions(company_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_status  ON requisitions(status);

-- ─────────────────────────────────────────────────────────────
-- 3. ÓRDENES DE COMPRA (purchase_orders)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  folio           TEXT NOT NULL,              -- OC-2026-001
  requisition_id  UUID REFERENCES requisitions(id),
  supplier_id     UUID REFERENCES suppliers(id),
  title           TEXT NOT NULL,
  items           JSONB NOT NULL DEFAULT '[]', -- [{desc, qty, unit_price, total}]
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  payment_terms   INTEGER DEFAULT 30,
  delivery_date   DATE,
  status          TEXT NOT NULL DEFAULT 'borrador'
                  CHECK (status IN ('borrador','enviada','confirmada','parcial','completada','cancelada')),
  received_at     TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_select" ON purchase_orders FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "po_insert" ON purchase_orders FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "po_update" ON purchase_orders FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_po_company    ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier   ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status     ON purchase_orders(status);

-- Cerrar FK circular requisitions → purchase_orders
ALTER TABLE requisitions
  ADD CONSTRAINT fk_req_po FOREIGN KEY (purchase_order_id)
  REFERENCES purchase_orders(id);

-- ─────────────────────────────────────────────────────────────
-- 4. COTIZACIONES DE PROVEEDORES (supplier_quotes)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requisition_id  UUID REFERENCES requisitions(id),
  supplier_id     UUID REFERENCES suppliers(id),
  folio_proveedor TEXT,
  items           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  validity_date   DATE,
  delivery_days   INTEGER,
  status          TEXT NOT NULL DEFAULT 'recibida'
                  CHECK (status IN ('recibida','en_revision','aceptada','rechazada')),
  ai_analysis     TEXT,                       -- output del copiloto Claude
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplier_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON supplier_quotes FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "quotes_insert" ON supplier_quotes FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "quotes_update" ON supplier_quotes FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_quotes_company  ON supplier_quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_supplier ON supplier_quotes(supplier_id);

-- ─────────────────────────────────────────────────────────────
-- 5. FACTURAS EMITIDAS / CUENTAS POR COBRAR (invoices_out)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices_out (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id         UUID,                       -- FK opcional a leads
  folio           TEXT NOT NULL,              -- F-2026-001
  uuid_cfdi       TEXT,                       -- UUID SAT
  customer_name   TEXT NOT NULL,
  customer_rfc    TEXT,
  customer_email  TEXT,
  items           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  payment_date    DATE,
  status          TEXT NOT NULL DEFAULT 'emitida'
                  CHECK (status IN ('borrador','emitida','enviada','parcial','pagada','vencida','cancelada')),
  days_overdue    INTEGER GENERATED ALWAYS AS (
                    CASE WHEN status NOT IN ('pagada','cancelada') AND due_date < CURRENT_DATE
                    THEN CURRENT_DATE - due_date ELSE 0 END
                  ) STORED,
  collection_priority TEXT DEFAULT 'normal'
                  CHECK (collection_priority IN ('urgente','alta','normal','baja')),
  last_contact_at TIMESTAMPTZ,
  ai_collection_note TEXT,                    -- mensaje generado por Claude
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices_out ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_out_select" ON invoices_out FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "inv_out_insert" ON invoices_out FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "inv_out_update" ON invoices_out FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_inv_out_company  ON invoices_out(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_out_status   ON invoices_out(status);
CREATE INDEX IF NOT EXISTS idx_inv_out_due_date ON invoices_out(due_date);

-- ─────────────────────────────────────────────────────────────
-- 6. FACTURAS RECIBIDAS / CUENTAS POR PAGAR (invoices_in)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices_in (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES suppliers(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  folio_proveedor TEXT,
  uuid_cfdi       TEXT,
  supplier_name   TEXT NOT NULL,
  supplier_rfc    TEXT,
  items           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  payment_date    DATE,
  status          TEXT NOT NULL DEFAULT 'recibida'
                  CHECK (status IN ('recibida','revisada','aprobada','programada','pagada','rechazada')),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices_in ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_in_select" ON invoices_in FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "inv_in_insert" ON invoices_in FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "inv_in_update" ON invoices_in FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_inv_in_company    ON invoices_in(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_in_supplier   ON invoices_in(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inv_in_due_date   ON invoices_in(due_date);

-- ─────────────────────────────────────────────────────────────
-- 7. PAGOS (payments)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('cobro','pago')),  -- cobro=CXC, pago=CXP
  invoice_out_id  UUID REFERENCES invoices_out(id),
  invoice_in_id   UUID REFERENCES invoices_in(id),
  amount          NUMERIC(14,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  method          TEXT CHECK (method IN ('transferencia','cheque','efectivo','tarjeta','otro')),
  reference       TEXT,                       -- número de transferencia/cheque
  uuid_complemento TEXT,                      -- complemento de pago SAT
  status          TEXT NOT NULL DEFAULT 'registrado'
                  CHECK (status IN ('registrado','conciliado','cancelado')),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON payments FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "payments_insert" ON payments FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "payments_update" ON payments FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_date    ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_type    ON payments(type);

-- ─────────────────────────────────────────────────────────────
-- 8. CONTRATOS (contracts)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('cliente','proveedor','laboral','otro')),
  counterpart_name TEXT NOT NULL,
  counterpart_rfc  TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  start_date      DATE,
  end_date        DATE,
  value           NUMERIC(14,2),
  currency        TEXT NOT NULL DEFAULT 'MXN',
  status          TEXT NOT NULL DEFAULT 'activo'
                  CHECK (status IN ('borrador','activo','vencido','renovado','cancelado')),
  auto_renew      BOOLEAN DEFAULT FALSE,
  alert_days      INTEGER DEFAULT 30,         -- alertar X días antes de vencimiento
  attachments     JSONB DEFAULT '[]',
  ai_summary      TEXT,                       -- resumen generado por Claude copiloto documental
  clauses_flags   JSONB DEFAULT '[]',         -- riesgos / cláusulas marcadas por Claude
  lead_id         UUID,
  supplier_id     UUID REFERENCES suppliers(id),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_select" ON contracts FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contracts_insert" ON contracts FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "contracts_update" ON contracts FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_contracts_company   ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status    ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date  ON contracts(end_date);

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS: updated_at automático
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','requisitions','purchase_orders',
    'supplier_quotes','invoices_out','invoices_in','contracts']
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t);
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: Resumen financiero para copiloto (usado por finanzas.html)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_financial_summary(p_company_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cxc_total     NUMERIC;
  v_cxc_vencida   NUMERIC;
  v_cxp_total     NUMERIC;
  v_cxp_proxima   NUMERIC;
  v_cobros_mes    NUMERIC;
  v_pagos_mes     NUMERIC;
BEGIN
  -- CXC: total pendiente de cobrar
  SELECT COALESCE(SUM(total),0) INTO v_cxc_total
  FROM invoices_out
  WHERE company_id = p_company_id
    AND status NOT IN ('pagada','cancelada');

  -- CXC vencida (días_vencidos > 0)
  SELECT COALESCE(SUM(total),0) INTO v_cxc_vencida
  FROM invoices_out
  WHERE company_id = p_company_id
    AND status NOT IN ('pagada','cancelada')
    AND due_date < CURRENT_DATE;

  -- CXP: total pendiente de pagar
  SELECT COALESCE(SUM(total),0) INTO v_cxp_total
  FROM invoices_in
  WHERE company_id = p_company_id
    AND status NOT IN ('pagada','rechazada');

  -- CXP próximos 30 días
  SELECT COALESCE(SUM(total),0) INTO v_cxp_proxima
  FROM invoices_in
  WHERE company_id = p_company_id
    AND status NOT IN ('pagada','rechazada')
    AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30;

  -- Cobros este mes
  SELECT COALESCE(SUM(amount),0) INTO v_cobros_mes
  FROM payments
  WHERE company_id = p_company_id
    AND type = 'cobro'
    AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE);

  -- Pagos este mes
  SELECT COALESCE(SUM(amount),0) INTO v_pagos_mes
  FROM payments
  WHERE company_id = p_company_id
    AND type = 'pago'
    AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE);

  RETURN JSON_BUILD_OBJECT(
    'cxc_total',     v_cxc_total,
    'cxc_vencida',   v_cxc_vencida,
    'cxp_total',     v_cxp_total,
    'cxp_proxima30', v_cxp_proxima,
    'cobros_mes',    v_cobros_mes,
    'pagos_mes',     v_pagos_mes,
    'flujo_neto_mes', v_cobros_mes - v_pagos_mes
  );
END;
$$;

-- Restringir RPC a usuarios autenticados
REVOKE ALL ON FUNCTION get_financial_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_financial_summary(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- DATOS DE PRUEBA — comentar en producción
-- ─────────────────────────────────────────────────────────────
-- INSERT INTO suppliers (company_id, name, rfc, email, payment_terms, category, status)
-- VALUES ('YOUR-COMPANY-UUID', 'Proveedor Demo SA de CV', 'PRO2024ABC', 'demo@proveedor.mx', 30, 'servicios', 'activo');

-- ============================================================
-- FIN DEL SCRIPT
-- Ejecutar completo en Supabase → SQL Editor → Run
-- ============================================================
