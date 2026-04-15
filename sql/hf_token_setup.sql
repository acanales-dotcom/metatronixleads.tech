-- ============================================================
-- HuggingFace API Token — portal_settings
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- Reemplaza YOUR_HF_TOKEN con tu token de huggingface.co/settings/tokens
-- ============================================================

INSERT INTO portal_settings (key, value)
VALUES ('hf_api_token', 'YOUR_HF_TOKEN_AQUI')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verificar (muestra solo los primeros y últimos 4 chars)
SELECT key,
       LEFT(value, 6) || '...' || RIGHT(value, 4) AS token_preview
FROM portal_settings
WHERE key = 'hf_api_token';
