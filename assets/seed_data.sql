-- ============================================================
-- SEED DATA — MetaTronix Modules
-- company_id: a0000000-0000-0000-0000-000000000001
-- ============================================================

-- SUPPLIERS
INSERT INTO suppliers (id, company_id, name, rfc, category, email, phone, payment_terms, rating, status)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Distribuidora CEMSA', 'CEMSA900101AAA', 'Materiales', 'ventas@cemsa.mx', '55-1234-5678', '30 días', 4.5, 'activo'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Tech Solutions MX', 'TSMX850615BBB', 'Tecnología', 'info@techsol.mx', '55-9876-5432', '15 días', 4.8, 'activo'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Papelería del Norte', 'PANO920320CCC', 'Papelería', 'pedidos@papnorte.mx', '81-2222-3333', '30 días', 3.9, 'activo'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Servicios IT IBANOR', 'SIIB010101DDD', 'TI', 'soporte@ibanortech.mx', '55-4444-5555', '60 días', 4.2, 'activo')
ON CONFLICT DO NOTHING;

-- REQUISITIONS
INSERT INTO requisitions (id, company_id, folio, title, category, requested_date, needed_date, amount_estimated, status, requested_by)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'REQ-2026-001', 'Laptops para equipo de ventas', 'Tecnología', CURRENT_DATE - 10, CURRENT_DATE + 5, 85000.00, 'aprobada', '85f3dcb5-0d8a-46a2-bf23-abf7ecec10ad'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'REQ-2026-002', 'Material de oficina Q2', 'Papelería', CURRENT_DATE - 5, CURRENT_DATE + 3, 12500.00, 'pendiente', '85f3dcb5-0d8a-46a2-bf23-abf7ecec10ad'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'REQ-2026-003', 'Licencias Microsoft 365', 'Software', CURRENT_DATE - 2, CURRENT_DATE + 10, 45000.00, 'borrador', '85f3dcb5-0d8a-46a2-bf23-abf7ecec10ad'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'REQ-2026-004', 'Muebles sala de juntas', 'Mobiliario', CURRENT_DATE - 15, CURRENT_DATE - 2, 68000.00, 'rechazada', '85f3dcb5-0d8a-46a2-bf23-abf7ecec10ad')
ON CONFLICT DO NOTHING;

-- PURCHASE ORDERS
INSERT INTO purchase_orders (id, company_id, folio, title, supplier_id, delivery_date, total, status)
SELECT
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000001',
  'OC-2026-001',
  'Equipos de cómputo Q2',
  id, CURRENT_DATE + 7, 85000.00, 'aprobada'
FROM suppliers WHERE company_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Tech Solutions MX'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO purchase_orders (id, company_id, folio, title, supplier_id, delivery_date, total, status)
SELECT
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000001',
  'OC-2026-002',
  'Material de papelería mensual',
  id, CURRENT_DATE + 3, 12500.00, 'en_proceso'
FROM suppliers WHERE company_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Papelería del Norte'
LIMIT 1
ON CONFLICT DO NOTHING;

-- INVOICES OUT (para Cobranza)
INSERT INTO invoices_out (id, company_id, folio, client_name, client_rfc, issue_date, due_date, total, paid, status, days_overdue)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0041', 'Comercializadora Azteca SA', 'CAZA900210EEE', CURRENT_DATE - 45, CURRENT_DATE - 15, 185000.00, 0, 'vencida', 15),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0042', 'Grupo Industrial Noreste', 'GINR850901FFF', CURRENT_DATE - 30, CURRENT_DATE + 0, 92500.00, 0, 'pendiente', 0),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0043', 'Distribuidora Centro SA', 'DCSA920415GGG', CURRENT_DATE - 20, CURRENT_DATE + 10, 67000.00, 0, 'pendiente', 0),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0044', 'Constructora del Valle', 'COVA010101HHH', CURRENT_DATE - 60, CURRENT_DATE - 30, 320000.00, 0, 'vencida', 30),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0045', 'Tecnología Avanzada SRL', 'TASR950720III', CURRENT_DATE - 10, CURRENT_DATE + 20, 45000.00, 45000.00, 'pagada', 0)
ON CONFLICT DO NOTHING;

-- INVOICES IN (para Finanzas)
INSERT INTO invoices_in (id, company_id, folio_supplier, supplier_name, category, issue_date, due_date, total, paid, status)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'PROV-1001', 'Tech Solutions MX', 'Tecnología', CURRENT_DATE - 15, CURRENT_DATE + 15, 85000.00, 0, 'pendiente'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'PROV-1002', 'Papelería del Norte', 'Papelería', CURRENT_DATE - 5, CURRENT_DATE + 25, 12500.00, 12500.00, 'pagada'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'PROV-1003', 'Distribuidora CEMSA', 'Materiales', CURRENT_DATE - 20, CURRENT_DATE + 10, 48000.00, 0, 'pendiente')
ON CONFLICT DO NOTHING;

SELECT 'Seed data insertado correctamente' as resultado;
