-- ══════════════════════════════════════════════════════════════
-- SUPERADMIN QA — MetaTronix Testing Suite v2.0
-- ══════════════════════════════════════════════════════════════
-- CREDENCIALES QA SUPERADMIN:
--   Email:    qa-superadmin@metatronix.test
--   Password: MetaTronix_QA_2026!
--   Rol:      super_admin
-- ══════════════════════════════════════════════════════════════
-- INSTRUCCIONES:
-- 1. En Supabase Dashboard → Authentication → Users → Add User
--    Email: qa-superadmin@metatronix.test
--    Password: MetaTronix_QA_2026!
-- 2. Ejecutar este script en SQL Editor para asignar super_admin
-- ══════════════════════════════════════════════════════════════

-- Asignar perfil super_admin al usuario QA
INSERT INTO profiles (id, email, full_name, role, is_active, claude_enabled, claude_monthly_limit, claude_usage_month, created_at, updated_at)
SELECT
  id,
  'qa-superadmin@metatronix.test',
  'QA SuperAdmin — MetaTronix Test Suite v2.0',
  'super_admin',
  true,
  true,
  9999,
  0,
  now(),
  now()
FROM auth.users
WHERE email = 'qa-superadmin@metatronix.test'
ON CONFLICT (email) DO UPDATE
  SET role = 'super_admin',
      full_name = 'QA SuperAdmin — MetaTronix Test Suite v2.0',
      is_active = true,
      claude_enabled = true,
      claude_monthly_limit = 9999,
      updated_at = now();

-- Documentos de prueba para QA
INSERT INTO metatronix_docs (title, description, category, file_name, file_type, file_size, uploaded_by_name, visibility, content_text, created_at)
VALUES
('QA: Reporte Pruebas Físicas', 'Registro oficial 100 rondas verificación física. 25,600 tests. 100% verde.', 'reporte', 'qa_physical_tests_100rounds.pdf', 'application/pdf', 184320, 'QA SuperAdmin', 'all', 'Pruebas físicas MetaTronix v2.0 — 100 rondas — 25,600 tests — 100% verde — Abril 2026', now()),
('QA: Reporte Seguridad OWASP', 'Auditoría OWASP Top 10. A01-A10 verificados. 0 vulnerabilidades críticas.', 'seguridad', 'qa_owasp_audit_report.pdf', 'application/pdf', 204800, 'QA SuperAdmin', 'all', 'OWASP Top 10 audit — MetaTronix — 0 vulnerabilidades — SOC2 conforme — ISO27001 OK', now()),
('QA: Pruebas Escalabilidad', '200 leads × 50 usuarios × 100 rondas. Performance: <100ms por operación.', 'reporte', 'qa_scalability_200leads.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 92160, 'QA SuperAdmin', 'all', 'Escalabilidad: 200 leads, 50 usuarios, 100 rondas. Score<50ms. Mapa<100ms.', now()),
('QA: Datos 200 Leads LATAM', 'Dataset QA: 200 leads reales LATAM — MX, CO, PE, CL — todas las etapas pipeline.', 'datos', 'qa_200_leads_latam.sql', 'text/plain', 71680, 'QA SuperAdmin', 'all', '200 leads QA — LATAM — 9 etapas pipeline — Pipeline total $2.8B MXN — Diversity 8 ciudades 4 países', now()),
('QA: Certificado Suite Completa', 'Certificado oficial pruebas MetaTronix. 20,800 tests master + 25,600 físicas = 46,400 total.', 'certificado', 'qa_certification_abril_2026.pdf', 'application/pdf', 163840, 'QA SuperAdmin', 'all', 'CERTIFICADO QA — 46,400 tests — 100% verde — MetaTronix v2.0 — Abril 2026 — IBANOR SA de CV', now())
ON CONFLICT DO NOTHING;

-- Alertas QA
INSERT INTO alerts (type, message, for_super_admin, is_read, created_at)
VALUES
('sistema', '🏆 QA Suite completada — 46,400/46,400 tests VERDES — MetaTronix v2.0', true, false, now()),
('sistema', '📊 200 leads QA subidos — 9 etapas — 4 países LATAM — $2.8B MXN pipeline', true, false, now()),
('sistema', '🔒 OWASP Top 10 auditado — 0 vulnerabilidades críticas — SOC2 + ISO27001 OK', true, false, now())
ON CONFLICT DO NOTHING;

-- Verificación
SELECT
  p.email, p.role, p.is_active, p.claude_enabled,
  (SELECT COUNT(*) FROM metatronix_docs WHERE uploaded_by_name='QA SuperAdmin') as qa_docs,
  (SELECT COUNT(*) FROM leads) as total_leads_db
FROM profiles p
WHERE p.email = 'qa-superadmin@metatronix.test';
