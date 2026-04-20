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

-- 2. Usuario demo: se crea manualmente desde el Supabase Auth dashboard
-- (demo@mttxai.com / role=admin / company=Grupo Nexus)
-- No se puede crear vía Management API SQL porque requiere auth.users

-- ============================================================
-- LEADS / PIPELINE
-- Nota: user_id usa acanales@ibanormexico.com (admin existente)
-- pipeline_stage usa valores válidos del constraint
-- ============================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE email = 'acanales@ibanormexico.com' LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No se encontró perfil para acanales@ibanormexico.com — saltando leads';
    RETURN;
  END IF;

  INSERT INTO leads (id, company_id, user_id, empresa, contacto_nombre, contacto_email, contacto_telefono, pipeline_stage, status, valor_estimado, notas, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Grupo Industrial MX',    'Carlos Mendoza',  'cmendoza@gipmx.com',    '55-1234-5678', 'propuesta',      'en_negociacion',  850000,  'Interesado en módulo completo. Demo agendada.', NOW()-INTERVAL'5d',  NOW()-INTERVAL'1d'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Constructora del Norte', 'Ana López',       'alopez@cdnorte.mx',     '81-9876-5432', 'negociacion',    'en_negociacion',  1200000, 'Decisión final esta semana. RFP enviada.',     NOW()-INTERVAL'12d', NOW()-INTERVAL'6h'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Farmacéutica Salud+',    'Roberto Sánchez', 'rsanchez@saludmas.mx',  '55-5555-1234', 'cierre',         'cerrado_ganado',  2300000, 'Contrato firmado. Onboarding en proceso.',     NOW()-INTERVAL'20d', NOW()-INTERVAL'2d'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Retail Express SA',      'Diana Torres',    'dtorres@retailex.mx',   '33-4444-8888', 'calificacion',   'contactado',      450000,  'PyME con 3 sucursales. Interés en finanzas.',  NOW()-INTERVAL'3d',  NOW()-INTERVAL'3d'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Transporte Veloz MX',    'Miguel Herrera',  'mherrera@tvmx.com',     '55-7777-2222', 'primer_contacto','contactado',      680000,  'Referido por Carlos M. Demo en 3 días.',       NOW()-INTERVAL'1d',  NOW()-INTERVAL'1d'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Tech Innovación MX',     'Sofía Ramírez',   'sramirez@techinno.mx',  '55-3333-9999', 'propuesta',      'en_negociacion',  920000,  'Necesitan CRM + Finanzas + IA. Presupuesto OK.',NOW()-INTERVAL'7d', NOW()-INTERVAL'2d'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Manufactura Precisa SA', 'Jorge Castro',    'jcastro@mprecisa.mx',   '81-2222-4444', 'cierre',         'cerrado_perdido', 1500000, 'Eligieron competencia por precio. Follow-up Q3.',NOW()-INTERVAL'30d',NOW()-INTERVAL'10d'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Alimentos del Pacífico', 'Patricia Vega',   'pvega@alpacmx.mx',      '33-8888-3333', 'negociacion',    'en_negociacion',  780000,  'Requieren módulo de compras. Aprobación CFO.',  NOW()-INTERVAL'9d',  NOW()-INTERVAL'4h'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Energía Limpia SA',      'Luis Moreno',     'lmoreno@elimpsa.mx',    '55-6666-1111', 'calificacion',   'contactado',      1900000, 'Enterprise. 50+ usuarios. Reunión C-Level.',   NOW()-INTERVAL'2d',  NOW()-INTERVAL'2d'),
    (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', v_user_id, 'Servicios Digitales MX', 'Elena Ruiz',      'eruiz@sdmx.com.mx',     '55-1111-7777', 'cierre',         'cerrado_ganado',  560000,  'Plan Business. Activo desde esta semana.',     NOW()-INTERVAL'14d', NOW()-INTERVAL'5d')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Leads insertados: 10 registros para company_id d0000000-0000-0000-0000-000000000001';
END $$;

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
INSERT INTO requisitions (id, company_id, folio, title, category, requested_date, needed_date, amount_estimated, status)
VALUES
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'REQ-2026-001', 'Licencias Microsoft 365 E3 — 50 usuarios', 'Software',      CURRENT_DATE-8,  CURRENT_DATE+7,  185000.00, 'aprobada'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'REQ-2026-002', 'Servidores AWS EC2 Q2',                    'Infraestructura',CURRENT_DATE-3, CURRENT_DATE+14, 92000.00,  'pendiente'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'REQ-2026-003', 'Material de oficina trimestral',           'Papelería',     CURRENT_DATE-1,  CURRENT_DATE+5,  18500.00,  'borrador'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000001', 'REQ-2026-004', 'Consultoría transformación digital',       'Consultoría',   CURRENT_DATE-15, CURRENT_DATE-5,  350000.00, 'completada')
ON CONFLICT DO NOTHING;

SELECT 'Demo data Grupo Nexus insertado correctamente' AS resultado;
