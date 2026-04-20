-- ============================================================
-- RLS MULTICOMPANY — MetaTronix / MTTX AI
-- Actualiza políticas de tablas operativas para usar user_companies
-- Un usuario puede ver datos de CUALQUIER empresa a la que pertenece
-- company_id activo se aplica en el FRONTEND (applyCompanyFilter)
-- ============================================================

-- Helper: usuario pertenece a la empresa del registro
CREATE OR REPLACE FUNCTION user_has_company_access(cid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid() AND company_id = cid
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin','super_admin')
  );
$$;

-- ── LEADS ─────────────────────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select"  ON leads;
DROP POLICY IF EXISTS "leads_insert"  ON leads;
DROP POLICY IF EXISTS "leads_update"  ON leads;
DROP POLICY IF EXISTS "leads_delete"  ON leads;

CREATE POLICY "leads_select" ON leads FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(company_id));
CREATE POLICY "leads_insert" ON leads FOR INSERT
  WITH CHECK (user_has_company_access(company_id));
CREATE POLICY "leads_update" ON leads FOR UPDATE
  USING (user_has_company_access(company_id));
CREATE POLICY "leads_delete" ON leads FOR DELETE
  USING (user_has_company_access(company_id));

-- ── INVOICES_OUT ──────────────────────────────────────────────────────────
ALTER TABLE invoices_out ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_out_select" ON invoices_out;
DROP POLICY IF EXISTS "inv_out_insert" ON invoices_out;
DROP POLICY IF EXISTS "inv_out_update" ON invoices_out;
DROP POLICY IF EXISTS "inv_out_delete" ON invoices_out;

CREATE POLICY "inv_out_select" ON invoices_out FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(company_id));
CREATE POLICY "inv_out_insert" ON invoices_out FOR INSERT
  WITH CHECK (user_has_company_access(company_id));
CREATE POLICY "inv_out_update" ON invoices_out FOR UPDATE
  USING (user_has_company_access(company_id));
CREATE POLICY "inv_out_delete" ON invoices_out FOR DELETE
  USING (user_has_company_access(company_id));

-- ── INVOICES_IN ───────────────────────────────────────────────────────────
ALTER TABLE invoices_in ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_in_select" ON invoices_in;
DROP POLICY IF EXISTS "inv_in_insert" ON invoices_in;
DROP POLICY IF EXISTS "inv_in_update" ON invoices_in;
DROP POLICY IF EXISTS "inv_in_delete" ON invoices_in;

CREATE POLICY "inv_in_select" ON invoices_in FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(company_id));
CREATE POLICY "inv_in_insert" ON invoices_in FOR INSERT
  WITH CHECK (user_has_company_access(company_id));
CREATE POLICY "inv_in_update" ON invoices_in FOR UPDATE
  USING (user_has_company_access(company_id));
CREATE POLICY "inv_in_delete" ON invoices_in FOR DELETE
  USING (user_has_company_access(company_id));

-- ── SUPPLIERS ─────────────────────────────────────────────────────────────
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(company_id));
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  WITH CHECK (user_has_company_access(company_id));
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  USING (user_has_company_access(company_id));
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
  USING (user_has_company_access(company_id));

-- ── REQUISITIONS ──────────────────────────────────────────────────────────
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "req_select" ON requisitions;
DROP POLICY IF EXISTS "req_insert" ON requisitions;
DROP POLICY IF EXISTS "req_update" ON requisitions;
DROP POLICY IF EXISTS "req_delete" ON requisitions;

CREATE POLICY "req_select" ON requisitions FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(company_id));
CREATE POLICY "req_insert" ON requisitions FOR INSERT
  WITH CHECK (user_has_company_access(company_id));
CREATE POLICY "req_update" ON requisitions FOR UPDATE
  USING (user_has_company_access(company_id));
CREATE POLICY "req_delete" ON requisitions FOR DELETE
  USING (user_has_company_access(company_id));

-- ── PURCHASE_ORDERS ───────────────────────────────────────────────────────
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_select" ON purchase_orders;
DROP POLICY IF EXISTS "po_insert" ON purchase_orders;
DROP POLICY IF EXISTS "po_update" ON purchase_orders;
DROP POLICY IF EXISTS "po_delete" ON purchase_orders;

CREATE POLICY "po_select" ON purchase_orders FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(company_id));
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT
  WITH CHECK (user_has_company_access(company_id));
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE
  USING (user_has_company_access(company_id));
CREATE POLICY "po_delete" ON purchase_orders FOR DELETE
  USING (user_has_company_access(company_id));

-- ── ORG_PULSE / EXECUTIVE_DECISIONS ───────────────────────────────────────
ALTER TABLE org_pulse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pulse_select" ON org_pulse;
DROP POLICY IF EXISTS "pulse_insert" ON org_pulse;
CREATE POLICY "pulse_select" ON org_pulse FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(company_id));
CREATE POLICY "pulse_insert" ON org_pulse FOR INSERT
  WITH CHECK (user_has_company_access(company_id));

ALTER TABLE executive_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "edec_select" ON executive_decisions;
DROP POLICY IF EXISTS "edec_insert" ON executive_decisions;
CREATE POLICY "edec_select" ON executive_decisions FOR SELECT
  USING (company_id IS NULL OR user_has_company_access(company_id));
CREATE POLICY "edec_insert" ON executive_decisions FOR INSERT
  WITH CHECK (user_has_company_access(company_id));

SELECT 'RLS multicompany aplicado correctamente' AS resultado;
