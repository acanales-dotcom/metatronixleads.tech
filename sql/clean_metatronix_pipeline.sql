-- ============================================================
-- LIMPIEZA PIPELINE — Empresa MetaTronix SA de CV
-- company_id = 'c0000000-0000-0000-0000-000000000001'
--
-- Elimina TODOS los datos demo del pipeline de MetaTronix:
-- leads, contacts, activity_logs, org_pulse
-- No toca: usuarios, perfiles, empresa, documentos reales
-- ============================================================

-- Leads (pipeline de ventas)
DELETE FROM leads
WHERE company_id = 'c0000000-0000-0000-0000-000000000001';

-- Contacts (CRM contacts vinculados)
DELETE FROM contacts
WHERE company_id = 'c0000000-0000-0000-0000-000000000001';

-- Activity logs demo
DELETE FROM activity_logs
WHERE company_id = 'c0000000-0000-0000-0000-000000000001';

-- Org pulse demo
DELETE FROM org_pulse
WHERE company_id = 'c0000000-0000-0000-0000-000000000001';

-- Verificación final
SELECT 'leads'         AS tabla, COUNT(*) AS total FROM leads         WHERE company_id = 'c0000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'contacts',              COUNT(*)           FROM contacts       WHERE company_id = 'c0000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'activity_logs',         COUNT(*)           FROM activity_logs  WHERE company_id = 'c0000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'org_pulse',             COUNT(*)           FROM org_pulse      WHERE company_id = 'c0000000-0000-0000-0000-000000000001';
