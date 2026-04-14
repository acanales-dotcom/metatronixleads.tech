-- ============================================================
-- USUARIO TEST FÍSICO + DATOS DE PRUEBA
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-04-13
-- ============================================================
-- INSTRUCCIONES:
-- 1. Primero crea el usuario manualmente en Supabase:
--    Authentication → Users → Add user
--    Email: test.fisico@metatronixleads.tech
--    Password: TestMTX2026!
--    Marcar "Auto Confirm User"
--
-- 2. Copia el UUID del usuario creado y reemplaza
--    'UUID_DEL_USUARIO_TEST' en este script
--
-- 3. Ejecuta este script en el SQL Editor
-- ============================================================

-- PASO 1: Actualizar perfil del usuario test (reemplaza el UUID)
-- El trigger handle_new_user ya crea el perfil automáticamente,
-- solo necesitas actualizar sus campos:

UPDATE profiles
SET
  full_name            = 'Test Físico MTX',
  role                 = 'user',
  is_active            = TRUE,
  perplexity_enabled   = TRUE,
  perplexity_pending_auth = FALSE,
  claude_enabled       = TRUE,
  claude_monthly_limit = 100,
  claude_usage_month   = 0,
  claude_reset_month   = TO_CHAR(NOW(), 'YYYY-MM')
WHERE email = 'test.fisico@metatronixleads.tech';

-- PASO 2: Verificar que el perfil quedó correcto
SELECT id, email, full_name, role, is_active,
       perplexity_enabled, claude_enabled
FROM profiles
WHERE email = 'test.fisico@metatronixleads.tech';

-- ============================================================
-- INSERTAR DATOS DE PRUEBA EN metatronix_docs
-- (estudios de mercado simulados para verificar que
--  el flujo oportunidades → mtx-docs funciona)
-- ============================================================

-- Estudio 1: Búsqueda de Leads
INSERT INTO metatronix_docs (
  title, description, category, visibility,
  file_name, file_type, file_size,
  file_data, text_content,
  uploaded_by_name, created_at
) VALUES (
  '🎯 TEST: Leads OXXO y Femsa para Metaview Systems',
  'Búsqueda de leads en retail mexicano para computer vision',
  'estudios_mercado',
  'all',
  'estudio-leads-test-1744000001.txt',
  'text/plain',
  1500,
  encode(
    'ESTUDIO DE MERCADO - Búsqueda de Leads
Consulta: Leads OXXO y Femsa para Metaview Systems
Fecha: 2026-04-13 10:00:00
Segmento: Búsqueda de Leads

------------------------------------------------------------

ANÁLISIS DE LEADS - RETAIL MEXICANO

1. OXXO (FEMSA)
   - 20,000+ tiendas en México y LATAM
   - Pain points: pérdidas por robo (shrinkage ~2-3% ventas)
   - Fit: Metaview Systems para detección de comportamientos
   - Decisores: FEMSA Digital, VP de Operaciones

2. Liverpool
   - 135 tiendas, líderes en departamental premium
   - Pain points: optimización de flujo de clientes
   - Fit: analítica de retail y computer vision

PRÓXIMOS PASOS COMERCIALES:
- Contactar FEMSA Digital en Monterrey
- Preparar demo de Metaview Systems para retail'::bytea,
    'base64'
  ),
  'ESTUDIO DE MERCADO - Búsqueda de Leads
Consulta: Leads OXXO y Femsa para Metaview Systems
Segmento: Búsqueda de Leads

ANÁLISIS DE LEADS - RETAIL MEXICANO

1. OXXO (FEMSA) - 20,000+ tiendas en México y LATAM
   Pain points: pérdidas por robo, optimización operacional
   Fit: Metaview Systems para detección de comportamientos

2. Liverpool - 135 tiendas premium
   Pain points: optimización de flujo de clientes
   Fit: analítica de retail y computer vision',
  'Test Físico MTX',
  NOW() - INTERVAL '2 hours'
);

-- Estudio 2: Estudio de Mercado
INSERT INTO metatronix_docs (
  title, description, category, visibility,
  file_name, file_type, file_size,
  file_data, text_content,
  uploaded_by_name, created_at
) VALUES (
  '📊 TEST: Mercado de Computer Vision en México 2025',
  'Tamaño del mercado de visión artificial en México y LATAM',
  'estudios_mercado',
  'all',
  'estudio-mercado-test-1744000002.txt',
  'text/plain',
  2000,
  encode(
    'ESTUDIO DE MERCADO - Estudio de Mercado
Consulta: Mercado de Computer Vision en México 2025
Fecha: 2026-04-13 11:00:00
Segmento: Estudio de Mercado

------------------------------------------------------------

MERCADO DE COMPUTER VISION - MÉXICO Y LATAM 2025

TAM (Total Addressable Market): $1.2B USD en LATAM
SAM (Serviceable): $380M USD en México
CAGR: 23% anual proyectado 2024-2029

PRINCIPALES SECTORES:
- Retail: 35% del mercado
- Manufactura: 28%
- Salud: 15%
- Gobierno: 12%
- Logística: 10%

COMPETIDORES CLAVE:
- Avigilon (Motorola Solutions)
- Axis Communications
- Dahua Technology
- HikVision

POSICIONAMIENTO METATRONIX:
- Diferenciador: IA especializada para LATAM
- Ventaja: soporte local y español nativo'::bytea,
    'base64'
  ),
  'MERCADO DE COMPUTER VISION - MÉXICO Y LATAM 2025

TAM: $1.2B USD en LATAM | SAM: $380M USD en México
CAGR: 23% anual proyectado 2024-2029

SECTORES: Retail 35%, Manufactura 28%, Salud 15%, Gobierno 12%

COMPETIDORES: Avigilon, Axis, Dahua, HikVision
DIFERENCIADOR MTX: IA especializada para LATAM con soporte local',
  'Test Físico MTX',
  NOW() - INTERVAL '1 hour'
);

-- Verificar que se insertaron
SELECT id, title, category, visibility, uploaded_by_name, created_at
FROM metatronix_docs
WHERE category = 'estudios_mercado'
ORDER BY created_at DESC
LIMIT 10;
