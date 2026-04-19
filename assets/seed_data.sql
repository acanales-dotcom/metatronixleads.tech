-- ============================================================
-- SEED DATA — MetaTronix Modules (schema-validated v2)
-- company_id: a0000000-0000-0000-0000-000000000001
-- ============================================================

-- SUPPLIERS
-- payment_terms = INTEGER (días de crédito)
INSERT INTO suppliers (id, company_id, name, rfc, email, phone, payment_terms, category, status, rating)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Distribuidora CEMSA',  'CEMSA900101AAA', 'ventas@cemsa.mx',      '55-1234-5678', 30, 'Materiales', 'activo', 4.5),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Tech Solutions MX',    'TSMX850615BBB', 'info@techsol.mx',       '55-9876-5432', 15, 'Tecnología', 'activo', 4.8),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Papelería del Norte',  'PANO920320CCC', 'pedidos@papnorte.mx',   '81-2222-3333', 30, 'Papelería',  'activo', 3.9),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Servicios IT IBANOR',  'SIIB010101DDD', 'soporte@ibanortech.mx', '55-4444-5555', 60, 'TI',         'activo', 4.2)
ON CONFLICT DO NOTHING;

-- REQUISITIONS
-- Status: 'borrador','pendiente','aprobada','rechazada','cancelada','completada'
INSERT INTO requisitions (id, company_id, folio, title, category, requested_date, needed_date, amount_estimated, status, requested_by)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'REQ-2026-001', 'Laptops para equipo de ventas', 'Tecnología', CURRENT_DATE - 10, CURRENT_DATE + 5,  85000.00, 'aprobada',  '85f3dcb5-0d8a-46a2-bf23-abf7ecec10ad'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'REQ-2026-002', 'Material de oficina Q2',        'Papelería',  CURRENT_DATE - 5,  CURRENT_DATE + 3,  12500.00, 'pendiente', '85f3dcb5-0d8a-46a2-bf23-abf7ecec10ad'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'REQ-2026-003', 'Licencias Microsoft 365',       'Software',   CURRENT_DATE - 2,  CURRENT_DATE + 10, 45000.00, 'borrador',  '85f3dcb5-0d8a-46a2-bf23-abf7ecec10ad'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'REQ-2026-004', 'Muebles sala de juntas',        'Mobiliario', CURRENT_DATE - 15, CURRENT_DATE - 2,  68000.00, 'rechazada', '85f3dcb5-0d8a-46a2-bf23-abf7ecec10ad')
ON CONFLICT DO NOTHING;

-- PURCHASE ORDERS
-- Status: 'borrador','enviada','confirmada','parcial','completada','cancelada'
INSERT INTO purchase_orders (id, company_id, folio, title, supplier_id, delivery_date, total, status)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001',
       'OC-2026-001', 'Equipos de cómputo Q2',
       id, CURRENT_DATE + 7, 85000.00, 'confirmada'
FROM suppliers WHERE company_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Tech Solutions MX'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO purchase_orders (id, company_id, folio, title, supplier_id, delivery_date, total, status)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001',
       'OC-2026-002', 'Material de papelería mensual',
       id, CURRENT_DATE + 3, 12500.00, 'enviada'
FROM suppliers WHERE company_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'Papelería del Norte'
LIMIT 1
ON CONFLICT DO NOTHING;

-- INVOICES OUT (para Cobranza)
-- Columns: customer_name, customer_rfc (NOT client_name/client_rfc)
-- Status: 'borrador','emitida','enviada','parcial','pagada','vencida','cancelada'
INSERT INTO invoices_out (id, company_id, folio, customer_name, customer_rfc, issue_date, due_date, total, status, days_overdue)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0041', 'Comercializadora Azteca SA', 'CAZA900210EEE', CURRENT_DATE - 45, CURRENT_DATE - 15, 185000.00, 'vencida', 15),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0042', 'Grupo Industrial Noreste',   'GINR850901FFF', CURRENT_DATE - 30, CURRENT_DATE,      92500.00,  'enviada',  0),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0043', 'Distribuidora Centro SA',    'DCSA920415GGG', CURRENT_DATE - 20, CURRENT_DATE + 10, 67000.00,  'enviada',  0),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0044', 'Constructora del Valle',     'COVA010101HHH', CURRENT_DATE - 60, CURRENT_DATE - 30, 320000.00, 'vencida', 30),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FAC-2026-0045', 'Tecnología Avanzada SRL',    'TASR950720III', CURRENT_DATE - 10, CURRENT_DATE + 20, 45000.00,  'pagada',   0)
ON CONFLICT DO NOTHING;

-- INVOICES IN (para Finanzas)
-- No 'category' column in schema; Status: 'recibida','revisada','aprobada','programada','pagada','rechazada'
INSERT INTO invoices_in (id, company_id, folio_proveedor, supplier_name, issue_date, due_date, total, status)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'PROV-1001', 'Tech Solutions MX',   CURRENT_DATE - 15, CURRENT_DATE + 15, 85000.00, 'recibida'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'PROV-1002', 'Papelería del Norte', CURRENT_DATE - 5,  CURRENT_DATE + 25, 12500.00, 'pagada'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'PROV-1003', 'Distribuidora CEMSA', CURRENT_DATE - 20, CURRENT_DATE + 10, 48000.00, 'recibida')
ON CONFLICT DO NOTHING;

SELECT 'Seed data insertado correctamente' AS resultado;
