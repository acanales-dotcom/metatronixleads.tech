-- ============================================================
-- FIX: Integridad de companies — asegurar todos los IDs fijos
--
-- Problema: multicompany_setup.sql usa DROP TABLE CASCADE, lo que
-- elimina companies y deja huérfanos cualquier registro que referencie
-- IDs que no se re-inserten. Nexus (d0000000-...) se pierde en cada
-- re-ejecución porque multicompany_setup.sql solo inserta a/b/c.
--
-- Seguro de re-ejecutar (ON CONFLICT DO UPDATE no destruye datos).
-- ============================================================

-- 1. Asegurar que los 4 IDs fijos existen en companies
INSERT INTO companies (id, slug, name, status)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ibanor',     'IBANOR SA de CV',     'activo'),
  ('b0000000-0000-0000-0000-000000000001', 'starke',     'Starke',              'activo'),
  ('c0000000-0000-0000-0000-000000000001', 'metatronix', 'MetaTronix',          'activo'),
  ('d0000000-0000-0000-0000-000000000001', 'nexus-demo', 'Grupo Nexus SA de CV','activo')
ON CONFLICT (id) DO UPDATE
  SET status = 'activo',
      slug   = EXCLUDED.slug;

-- 2. Verificar resultado
SELECT id, slug, name, status FROM companies ORDER BY slug;

-- 3. Diagnóstico: registros con company_id fuera de estos 4
SELECT 'leads' AS tabla, company_id, count(*) AS registros
FROM leads
WHERE company_id NOT IN (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001'
) OR company_id IS NULL
GROUP BY company_id

UNION ALL

SELECT 'metatronix_docs', company_id, count(*)
FROM metatronix_docs
WHERE company_id NOT IN (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001'
) OR company_id IS NULL
GROUP BY company_id

UNION ALL

SELECT 'events', company_id, count(*)
FROM events
WHERE company_id NOT IN (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001'
) OR company_id IS NULL
GROUP BY company_id;

SELECT 'fix_companies_integrity OK' AS status;
