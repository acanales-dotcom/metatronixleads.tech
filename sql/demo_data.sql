-- ============================================================
-- DEMO DATA — MTTX AI
-- Empresa: Grupo Nexus SA de CV
-- company_id: d0000000-0000-0000-0000-000000000001
-- Usuario demo: demo@mttxai.com
-- ============================================================

-- 1. Empresa demo
INSERT INTO companies (id, slug, name, rfc, status) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'nexus-demo', 'Grupo Nexus SA de CV', 'GNX900101AAA', 'activo')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name;

-- 2. Usuario demo en auth.users (requiere Supabase Auth API — ver workflow)
-- El perfil se crea aquí asumiendo que el usuario ya existe en auth
INSERT INTO profiles (id, email, full_name, role, company_id)
VALUES ('00000000-0000-0000-0000-000000000099', 'demo@mttxai.com', 'Demo MTTX AI', 'admin', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET role='admin', company_id='d0000000-0000-0000-0000-000000000001';

-- Membresía: demo tiene acceso a su empresa
INSERT INTO user_companies (user_id, company_id, role)
VALUES ('00000000-0000-0000-0000-000000000099', 'd0000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT DO NOTHING;

-- ============================================================
-- LEADS / PIPELINE
-- ============================================================
INSERT INTO leads (id, company_id, name, company, email, phone, stage, status, value, pipeline_value, deal_value, notes, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Carlos Mendoza',      'Grupo Industrial MX',     'cmendoza@gipmx.com',    '55-1234-5678', 'Propuesta',      'activo',  850000, 850000,  0,       'Interesado en módulo completo. Demo agendada.', NOW()-INTERVAL'5d',  NOW()-INTERVAL'1d'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Ana López',           'Constructora del Norte',  'alopez@cdnorte.mx',     '81-9876-5432', 'Negociación',    'activo',  1200000,1200000, 0,       'Decisión final esta semana. RFP enviada.',     NOW()-INTERVAL'12d', NOW()-INTERVAL'6h'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Roberto Sánchez',     'Farmacéutica Salud+',     'rsanchez@saludmas.mx',  '55-5555-1234', 'Cerrado',        'ganado',  2300000,0,       2300000, 'Contrato firmado. Onboarding en proceso.',     NOW()-INTERVAL'20d', NOW()-INTERVAL'2d'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Diana Torres',        'Retail Express SA',       'dtorres@retailex.mx',   '33-4444-8888', 'Calificación',   'activo',  450000, 450000,  0,       'PyME con 3 sucursales. Interés en finanzas.',  NOW()-INTERVAL'3d',  NOW()-INTERVAL'3d'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Miguel Herrera',      'Transporte Veloz MX',     'mherrera@tvmx.com',     '55-7777-2222', 'Descubrimiento', 'activo',  680000, 680000,  0,       'Referido por Carlos M. Demo en 3 días.',       NOW()-INTERVAL'1d',  NOW()-INTERVAL'1d'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Sofía Ramírez',       'Tech Innovación MX',      'sramirez@techinno.mx',  '55-3333-9999', 'Propuesta',      'activo',  920000, 920000,  0,       'Necesitan CRM + Finanzas + IA. Presupuesto OK.',NOW()-INTERVAL'7d', NOW()-INTERVAL'2d'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Jorge Castro',        'Manufactura Precisa SA',  'jcastro@mprecisa.mx',   '81-2222-4444', 'Cerrado',        'perdido', 1500000,0,       0,       'Eligieron competencia por precio. Follow-up Q3.',NOW()-INTERVAL'30d',NOW()-INTERVAL'10d'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Patricia Vega',       'Alimentos del Pacífico',  'pvega@alpacmx.mx',      '33-8888-3333', 'Negociación',    'activo',  780000, 780000,  0,       'Requieren módulo de compras. Aprobación CFO.',  NOW()-INTERVAL'9d',  NOW()-INTERVAL'4h'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Luis Moreno',         'Energía Limpia SA',       'lmoreno@elimpsa.mx',    '55-6666-1111', 'Calificación',   'activo',  1900000,1900000, 0,       'Enterprise. 50+ usuarios. Reunión C-Level.',   NOW()-INTERVAL'2d',  NOW()-INTERVAL'2d'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Elena Ruiz',          'Servicios Digitales MX',  'eruiz@sdmx.com.mx',     '55-1111-7777', 'Cerrado',        'ganado',  560000, 0,       560000,  'Plan Business. Activo desde esta semana.',     NOW()-INTERVAL'14d', NOW()-INTERVAL'5d')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROVEEDORES
-- ============================================================
INSERT INTO suppliers (id, company_id, name, rfc, email, phone, payment_terms, category, status, rating)
VALUES
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Microsoft México SA',       'MMX850101AAA', 'ventas@microsoft.com.mx',  '55-5225-0960', 30, 'Software',     'activo', 4.9),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'AWS Latin America',          'ALA190101BBB', 'aws-mx@amazon.com',         '55-9000-0000', 30, 'Infraestructura','activo',4.8),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Office Depot México',        'ODM930601CCC', 'empresas@officedepot.mx',   '800-800-0000', 30, 'Papelería',    'activo', 4.1),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'CEMEX Materiales SA',        'CMA920101DDD', 'corporativo@cemex.com',     '81-8888-0000', 60, 'Materiales',   'activo', 4.3),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'Deloitte México Consultoría','DMC010101EEE', 'contacto@deloitte.com.mx',  '55-5080-6000', 45, 'Consultoría',  'activo', 4.7)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FACTURAS POR COBRAR (invoices_out)
-- ============================================================
INSERT INTO invoices_out (id, company_id, folio, customer_name, customer_rfc, issue_date, due_date, total, status, days_overdue)
VALUES
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'FAC-2026-0001', 'Grupo Industrial MX',   'GIMX850101XXX', CURRENT_DATE-50, CURRENT_DATE-20, 485000.00, 'vencida', 20),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'FAC-2026-0002', 'Farmacéutica Salud+',   'FSM920315YYY', CURRENT_DATE-30, CURRENT_DATE,    1150000.00,'enviada',  0),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'FAC-2026-0003', 'Retail Express SA',     'RES010101ZZZ', CURRENT_DATE-15, CURRENT_DATE+15, 225000.00, 'enviada',  0),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'FAC-2026-0004', 'Tech Innovación MX',    'TIM180901WWW', CURRENT_DATE-60, CURRENT_DATE-30, 920000.00, 'vencida', 30),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'FAC-2026-0005', 'Alimentos del Pacífico','ADP950720VVV', CURRENT_DATE-10, CURRENT_DATE+20, 390000.00, 'enviada',  0),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'FAC-2026-0006', 'Energía Limpia SA',     'ELS200101UUU', CURRENT_DATE-5,  CURRENT_DATE+25, 760000.00, 'emitida',  0),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'FAC-2026-0007', 'Servicios Digitales MX','SDM170501TTT', CURRENT_DATE-20, CURRENT_DATE+10, 280000.00, 'pagada',   0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FACTURAS POR PAGAR (invoices_in)
-- ============================================================
INSERT INTO invoices_in (id, company_id, folio_proveedor, supplier_name, issue_date, due_date, total, status)
VALUES
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'MS-2026-4412', 'Microsoft México SA',     CURRENT_DATE-10, CURRENT_DATE+20, 185000.00, 'aprobada'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'AWS-INV-8890', 'AWS Latin America',        CURRENT_DATE-5,  CURRENT_DATE+25, 92000.00,  'recibida'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'OD-2026-3321', 'Office Depot México',      CURRENT_DATE-15, CURRENT_DATE+15, 18500.00,  'pagada'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'DLT-2026-0078','Deloitte México Consultoría',CURRENT_DATE-20,CURRENT_DATE+10,350000.00, 'programada')
ON CONFLICT DO NOTHING;

-- ============================================================
-- REQUISICIONES
-- ============================================================
INSERT INTO requisitions (id, company_id, folio, title, category, requested_date, needed_date, amount_estimated, status, requested_by)
VALUES
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'REQ-2026-001', 'Licencias Microsoft 365 E3 — 50 usuarios', 'Software',     CURRENT_DATE-8,  CURRENT_DATE+7,  185000.00, 'aprobada',  '00000000-0000-0000-0000-000000000099'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'REQ-2026-002', 'Servidores AWS EC2 Q2',                    'Infraestructura',CURRENT_DATE-3, CURRENT_DATE+14, 92000.00,  'pendiente', '00000000-0000-0000-0000-000000000099'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'REQ-2026-003', 'Material de oficina trimestral',           'Papelería',    CURRENT_DATE-1,  CURRENT_DATE+5,  18500.00,  'borrador',  '00000000-0000-0000-0000-000000000099'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'REQ-2026-004', 'Consultoría transformación digital',       'Consultoría',  CURRENT_DATE-15, CURRENT_DATE-5,  350000.00, 'completada','00000000-0000-0000-0000-000000000099')
ON CONFLICT DO NOTHING;

SELECT 'Demo data Grupo Nexus insertado correctamente' AS resultado;
