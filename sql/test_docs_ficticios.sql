-- ============================================================
-- TEST: Insertar documentos ficticios en metatronix_docs
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

INSERT INTO metatronix_docs (
  title, description, category, visibility,
  file_name, file_type, file_size, text_content,
  uploaded_by_name, created_at
) VALUES (
  '📊 Estudio de Mercado — Computer Vision México 2025',
  'Análisis TAM/SAM/SOM del mercado de visión artificial en México',
  'estudios_mercado',
  'all',
  'estudio-mercado-cv-mx-2025.txt',
  'text/plain',
  2108,
  'ESTUDIO DE MERCADO — COMPUTER VISION MÉXICO 2025
Generado por: MetaTronix Inteligencia de Mercados
Fecha: Abril 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESUMEN EJECUTIVO
━━━━━━━━━━━━━━━━
El mercado de Computer Vision en México alcanzó USD $840M en 2025,
con proyección de crecimiento al 31% CAGR hasta 2029.

TAMAÑO DE MERCADO
-----------------
TAM (Total Addressable Market): $4.2B USD — LATAM
SAM (Serviceable Market): $840M USD — México
SOM (Serviceable Obtainable): $168M USD — MetaTronix target

SECTORES CON MAYOR OPORTUNIDAD
--------------------------------
1. Retail & Comercio: 35% del mercado ($294M)
   - Prevención de pérdidas, analítica de clientes
   - Top prospectos: Liverpool, OXXO/FEMSA, Walmart México

2. Manufactura e Industrial: 28% ($235M)
   - Control de calidad automatizado, seguridad perimetral
   - Top prospectos: CEMEX, RASSINI, Vitro

3. Salud & Farma: 15% ($126M)
   - Diagnóstico asistido, monitoreo de pacientes
   - Top prospectos: Hospital ABC, Christus MUGUERZA, IMSS (gov)

4. Gobierno & Seguridad Pública: 12% ($101M)
   - Videovigilancia inteligente, control vehicular
   - Top prospectos: SEMOVI CDMX, SSP Jalisco

5. Logística & Supply Chain: 10% ($84M)
   - Clasificación automática, tracking de paquetes

COMPETIDORES PRINCIPALES
--------------------------
1. Axis Communications (Suecia) — 23% market share
2. Dahua Technology (China) — 18% market share  
3. Motorola Solutions / Avigilon — 15% market share
4. Hikvision — 12% market share
5. MetaTronix (Metaview Systems) — 4% market share → OBJETIVO: 12%

DIFERENCIADORES CLAVE METATRONIX
-----------------------------------
✓ IA entrenada para contexto latinoamericano
✓ Soporte 24/7 en español
✓ Integración nativa con SAT/IMSS/SUA
✓ Tiempo de implementación: 2 semanas vs 3 meses competencia
✓ Precio 40% menor que soluciones europeas

RECOMENDACIÓN ESTRATÉGICA
---------------------------
Priorizar verticales Retail e Industrial en Q2-Q3 2025.
Target de captación: 50 cuentas enterprise × USD $120K ARR = $6M ARR.

Fuentes: IDC LATAM 2025, Grand View Research, análisis interno MetaTronix.',
  'Sistema MetaTronix (Test)',
  NOW() - INTERVAL '6 hours'
);

INSERT INTO metatronix_docs (
  title, description, category, visibility,
  file_name, file_type, file_size, text_content,
  uploaded_by_name, created_at
) VALUES (
  '📋 Propuesta Ejecutiva — Liverpool Corporativo',
  'Propuesta de Metaview Systems para 135 tiendas Liverpool',
  'propuesta',
  'admin',
  'propuesta-liverpool-metaview-2025.txt',
  'text/plain',
  1937,
  'PROPUESTA EJECUTIVA CONFIDENCIAL
MetaTronix × Liverpool Corporativo
Solución: Metaview Systems — Inteligencia de Video para Retail
Fecha: Abril 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARA:    Ing. Carlos Mendoza, Director de Tecnología
DE:      Equipo de Ventas MetaTronix
VÁLIDA:  30 días a partir de la fecha de emisión

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUMEN EJECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Liverpool opera 135 tiendas departamentales en México con más de
45,000 empleados y procesa 38 millones de transacciones al año.

Identificamos 3 pain points críticos:
1. Shrinkage estimado en 2.8% de ventas → $1,680M MXN en pérdidas
2. Sin analytics de flujo de clientes por zona de tienda
3. Detección de incidentes de seguridad manual y reactiva

SOLUCIÓN PROPUESTA: METAVIEW SYSTEMS ENTERPRISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MÓDULO 1 — Loss Prevention AI
• Detección automática de comportamientos sospechosos
• Alertas en tiempo real al equipo de seguridad
• Reducción esperada de shrinkage: 60-75%
• ROI proyectado: 8 meses

MÓDULO 2 — Retail Analytics
• Heatmaps de tráfico por zona de tienda
• Análisis de tiempo de permanencia por producto
• Optimización de planograma basada en datos
• Dashboard ejecutivo en tiempo real

MÓDULO 3 — Queue Management
• Detección automática de filas largas
• Apertura predictiva de cajas adicionales
• Reducción de tiempo de espera: 40%

INVERSIÓN
━━━━━━━━━
Implementación piloto (5 tiendas): $2,400,000 MXN
Suscripción anual (135 tiendas): $18,500,000 MXN

ROI CALCULADO
━━━━━━━━━━━━━
Ahorro por reducción de shrinkage (año 1): $1,008,000,000 MXN
Inversión total año 1: $20,900,000 MXN
ROI: 4,824% en 12 meses

PRÓXIMOS PASOS
━━━━━━━━━━━━━━
1. Sesión de validación técnica (15 mayo)
2. Piloto 5 tiendas CDMX (junio - agosto)
3. Expansión nacional (septiembre)

Contacto: acanales@ibanormexico.com | +52 55 1234 5678',
  'Sistema MetaTronix (Test)',
  NOW() - INTERVAL '6 hours'
);

INSERT INTO metatronix_docs (
  title, description, category, visibility,
  file_name, file_type, file_size, text_content,
  uploaded_by_name, created_at
) VALUES (
  '🎓 Caso de Éxito — Aria New Gen × ITESM',
  'Implementación de plataforma educativa IA en Tec de Monterrey',
  'caso_exito',
  'all',
  'caso-exito-aria-itesm-2025.txt',
  'text/plain',
  1934,
  'CASO DE ÉXITO
Aria New Gen × Tecnológico de Monterrey
Implementación de Educación con IA para 18,000 estudiantes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTEXTO
━━━━━━━━
El Tecnológico de Monterrey buscaba transformar su modelo educativo
para preparar a sus egresados para la economía de la IA.

Desafíos identificados:
• 40% de estudiantes con bajo engagement en cursos en línea
• Profesores sin tiempo para retroalimentación personalizada
• Gap de habilidades digitales vs demanda del mercado laboral

SOLUCIÓN IMPLEMENTADA: ARIA NEW GEN ENTERPRISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Componentes desplegados:
1. AI Learning Assistant personalizado por estudiante
2. Analytics de progreso en tiempo real para profesores
3. Generación automática de ejercicios adaptativos
4. Simulador de entrevistas de trabajo con IA
5. Portfolio digital con proyectos validados por IA

RESULTADOS (6 MESES)
━━━━━━━━━━━━━━━━━━━━
Engagement en plataforma:     +67% (de 23% a 90% completación)
Calificaciones promedio:      +18 puntos porcentuales
Tiempo de retroalimentación:  -85% (de 5 días a 18 horas)
Satisfacción estudiantil:     4.7/5.0
Empleabilidad egresados:      +34% en primeros 6 meses

TESTIMONIAL
━━━━━━━━━━━
"Aria New Gen transformó completamente cómo nuestros estudiantes
aprenden. La personalización que logra la IA es algo que 
simplemente no es posible a escala humana."
— Dr. Alejandro Garza, Vicerrector Académico ITESM

IMPLEMENTACIÓN TÉCNICA
━━━━━━━━━━━━━━━━━━━━━━
• 18,000 usuarios concurrentes pico
• Tiempo de implementación: 6 semanas
• Integración con LMS Banner (SAP) existente
• GDPR y Ley Federal de Datos Personales compliant
• SLA: 99.95% uptime

INVERSIÓN Y ROI
━━━━━━━━━━━━━━━
Inversión: $4,200,000 MXN / año
Ahorro en personal docente de soporte: $2,800,000 MXN / año
Incremento en matrículas por reputación: $12,000,000 MXN / año
ROI año 1: 353%

Para más información: aria@metatronix.com',
  'Sistema MetaTronix (Test)',
  NOW() - INTERVAL '6 hours'
);

INSERT INTO metatronix_docs (
  title, description, category, visibility,
  file_name, file_type, file_size, text_content,
  uploaded_by_name, created_at
) VALUES (
  '⚙️ Ficha Técnica — QuantumTron Data Platform',
  'Especificaciones técnicas completas de QuantumTron',
  'ficha_tecnica',
  'all',
  'ficha-tecnica-quantumtron-v3.txt',
  'text/plain',
  2232,
  'FICHA TÉCNICA — QUANTUMTRON DATA PLATFORM v3.0
MetaTronix | Plataforma de Ciencia de Datos Enterprise
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESCRIPCIÓN GENERAL
━━━━━━━━━━━━━━━━━━━
QuantumTron es una plataforma end-to-end de ciencia de datos que
permite a empresas transformar sus datos brutos en Decision Packs
ejecutivos, sin requerir un equipo técnico interno.

ARQUITECTURA
━━━━━━━━━━━━
• Cloud-native (AWS / GCP / Azure)
• Procesamiento distribuido con Apache Spark
• ML Pipeline automatizado con AutoML
• API REST + GraphQL para integraciones
• SDK para Python, R, JavaScript

CAPACIDADES PRINCIPALES
━━━━━━━━━━━━━━━━━━━━━━━
1. INGESTA DE DATOS
   • 200+ conectores nativos (SAP, Oracle, Salesforce, etc.)
   • Batch y streaming en tiempo real
   • Data quality scoring automático
   • Lineage tracking completo

2. TRANSFORMACIÓN Y MODELADO
   • No-code data prep con UI drag-and-drop
   • Versioning automático de modelos
   • A/B testing de modelos integrado
   • Explainability (XAI) para cumplimiento regulatorio

3. VISUALIZACIÓN Y REPORTING
   • 50+ tipos de gráficas interactivas
   • Decision Packs ejecutivos automatizados
   • Alertas inteligentes basadas en anomalías
   • Reportes en español, inglés y portugués

RENDIMIENTO
━━━━━━━━━━━
• Procesamiento: hasta 10TB/hora
• Latencia de consultas: <200ms (p99)
• Disponibilidad: 99.99% SLA
• Escalabilidad: horizontal automática

SEGURIDAD Y CUMPLIMIENTO
━━━━━━━━━━━━━━━━━━━━━━━━
• SOC 2 Type II certificado
• ISO 27001 certificado
• GDPR compliant
• Ley Federal de Protección de Datos (México)
• LGPD compliant (Brasil)
• Cifrado AES-256 en tránsito y reposo

INTEGRACIONES CERTIFICADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━
SAP S/4HANA | Oracle ERP | Salesforce | HubSpot
Microsoft 365 | Google Workspace | Tableau | Power BI
Snowflake | Databricks | AWS Redshift | BigQuery

PRECIOS
━━━━━━━
Starter:    $1,999 USD/mes — hasta 5 usuarios, 100GB
Business:   $4,999 USD/mes — hasta 25 usuarios, 1TB
Enterprise: Precio personalizado — usuarios ilimitados

SOPORTE
━━━━━━━
• Chat 24/7 en español
• SLA: respuesta <2 horas para P1
• Customer Success Manager dedicado (Enterprise)
• Capacitación inicial incluida (8 horas)

Contacto técnico: quantumtron@metatronix.com',
  'Sistema MetaTronix (Test)',
  NOW() - INTERVAL '6 hours'
);

INSERT INTO metatronix_docs (
  title, description, category, visibility,
  file_name, file_type, file_size, text_content,
  uploaded_by_name, created_at
) VALUES (
  '🤖 Manual de Usuario — NeuroTron Lab Agentes IA',
  'Guía de implementación de agentes autónomos NeuroTron',
  'manual',
  'all',
  'manual-neurotron-lab-v2.txt',
  'text/plain',
  2129,
  'MANUAL DE USUARIO — NEUROTRON LAB
Plataforma de Agentes Autónomos de IA
Versión 2.0 | Abril 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INTRODUCCIÓN
━━━━━━━━━━━━
NeuroTron Lab permite crear, entrenar y desplegar agentes autónomos
de IA que ejecutan procesos de negocio complejos sin intervención humana.

CASOS DE USO VERIFICADOS
━━━━━━━━━━━━━━━━━━━━━━━━
• Atención al cliente 24/7 (reducción de costos 70%)
• Procesamiento de facturas (automatización 95%)
• Análisis de contratos legales (5 min vs 4 horas)
• Prospección de clientes (100 leads/día automatizados)
• Soporte técnico nivel 1 y 2

GUÍA DE INICIO RÁPIDO
━━━━━━━━━━━━━━━━━━━━━

PASO 1: CREAR UN AGENTE
------------------------
1. Accede a app.neurotronlab.com
2. Clic en "Nuevo Agente"
3. Selecciona template:
   - Agente de Ventas
   - Agente de Soporte
   - Agente de Datos
   - Agente Personalizado

PASO 2: CONFIGURAR CONOCIMIENTO
---------------------------------
1. Sube documentos base (PDF, DOCX, TXT)
2. Conecta APIs externas (CRM, ERP, etc.)
3. Define reglas de negocio en lenguaje natural
4. Establece límites de decisión autónoma

PASO 3: ENTRENAR Y PROBAR
--------------------------
1. Ejecuta sandbox de pruebas (1,000 escenarios sintéticos)
2. Revisa accuracy report
3. Ajusta prompts con el Prompt Studio visual
4. Aprueba para producción

PASO 4: DESPLEGAR
------------------
Opciones de despliegue:
• API endpoint
• Widget web embebible
• Integración WhatsApp Business
• Microsoft Teams / Slack bot
• Voz (VAPI integration)

MONITOREO Y MEJORA CONTINUA
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Dashboard de conversaciones en tiempo real
• Escalaciones automáticas al humano (configurable)
• Fine-tuning automático semanal
• A/B testing de versiones del agente

MÉTRICAS CLAVE A MONITOREAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• CSAT (Customer Satisfaction Score)
• Tasa de resolución en primera interacción
• Tasa de escalación a humano
• Tiempo promedio de resolución
• Ahorro en horas-hombre

SOPORTE TÉCNICO
━━━━━━━━━━━━━━━
Email: soporte@neurotronlab.com
Chat: En la plataforma (agente de soporte disponible 24/7 😊)
Documentación: docs.neurotronlab.com',
  'Sistema MetaTronix (Test)',
  NOW() - INTERVAL '6 hours'
);

INSERT INTO metatronix_docs (
  title, description, category, visibility,
  file_name, file_type, file_size, text_content,
  uploaded_by_name, created_at
) VALUES (
  '📈 Análisis Sectorial — FinTech LATAM para NeuroTron',
  'Oportunidades en automatización con IA para sector FinTech LATAM',
  'estudios_mercado',
  'all',
  'sectorial-fintech-latam-neurotron.txt',
  'text/plain',
  2823,
  'ANÁLISIS SECTORIAL — FINTECH LATAM
Oportunidades de Automatización IA para NeuroTron Lab
Generado: Inteligencia de Mercados MetaTronix | Abril 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PANORAMA DEL SECTOR
━━━━━━━━━━━━━━━━━━━
LATAM tiene 2,800+ FinTechs activas (2025), con México y Brasil
representando 65% del ecosistema regional.

Inversión VC en FinTech LATAM 2025: $5.2B USD
Top países: Brasil (42%), México (28%), Colombia (13%), Chile (9%)

PAIN POINTS IDENTIFICADOS
━━━━━━━━━━━━━━━━━━━━━━━━━
1. ONBOARDING DE CLIENTES
   • Proceso manual: 3-7 días promedio
   • Tasa de abandono: 68% en KYC
   • Costo por cliente onboarded: $45-$120 USD
   → Oportunidad NeuroTron: Agente de onboarding automático
     reduce a 2 horas y $8 USD por cliente

2. DETECCIÓN DE FRAUDE
   • Pérdidas por fraude LATAM: $3.2B USD/año
   • Reglas tradicionales: 40% de falsos positivos
   → Oportunidad: Agente de análisis de transacciones en tiempo real
     con ML adaptativo

3. SERVICIO AL CLIENTE
   • Volumen de tickets: 10,000-50,000/mes para FinTechs medianas
   • Costo agente humano: $8-15 USD por conversación
   → Oportunidad: Agente autónomo resuelve 85% de consultas
     a $0.30 USD por conversación

4. CUMPLIMIENTO REGULATORIO
   • CNBV México: reportes mensuales obligatorios
   • SAT: conciliación fiscal diaria
   • CONDUSEF: gestión de reclamaciones 30-day SLA
   → Oportunidad: Agente de compliance automatizado

TOP 10 PROSPECTOS CALIFICADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Clip — 3.5M comercios, necesita AI en dispute resolution
2. Conekta — payment gateway, 800K transacciones/día
3. Konfío — crédito PYME, proceso de underwriting manual
4. Kubo.financiero — lending P2P, 180K clientes activos
5. Credijusto — $500M portafolio, cobranza manual
6. Stori — 1.5M tarjetahabientes, soporte sobrecargado
7. Klar — neobank 300K usuarios, CAC alto en onboarding
8. Mercado Pago México — 18M usuarios, oportunidades en CS
9. Rappi Pay — 4.2M usuarios, ofrece NeuroTron para soporte
10. Nu México — 5M usuarios, potencial en fraud detection

ESTRATEGIA DE ENTRADA
━━━━━━━━━━━━━━━━━━━━━
QUARTER 2:
  • Pilot Clip (onboarding agent) — objetivo $240K ARR
  • Pilot Konfío (underwriting AI) — objetivo $180K ARR

QUARTER 3:
  • Expansión a 3 FinTechs mid-market
  • Lanzar vertical pack "NeuroTron for FinTech"
  • Target: $1.2M ARR sector FinTech

PRECIO RECOMENDADO
━━━━━━━━━━━━━━━━━━
Starter FinTech: $2,999 USD/mes (hasta 10K conversaciones)
Growth FinTech: $7,999 USD/mes (hasta 50K conversaciones)
Enterprise: Por volumen

ANÁLISIS COMPETITIVO
━━━━━━━━━━━━━━━━━━━━
Intercom AI: $1,200-3,000/mes — no especializado en FinTech LATAM
Zendesk AI: $800-2,000/mes — sin compliance CNBV
Salesforce Einstein: $15,000+/mes — out of reach para SMB FinTech
✅ NeuroTron: mejor relación precio/especialización en LATAM',
  'Sistema MetaTronix (Test)',
  NOW() - INTERVAL '6 hours'
);

-- Verificar inserción
SELECT id, title, category, visibility, uploaded_by_name, created_at
FROM metatronix_docs
WHERE uploaded_by_name = 'Sistema MetaTronix (Test)'
ORDER BY created_at DESC;