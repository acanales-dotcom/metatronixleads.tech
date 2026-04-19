#!/usr/bin/env python3
"""
run_admin_schema.py
Ejecuta assets/admin-schema.sql en Supabase via Management API.
Acepta: SUPABASE_ACCESS_TOKEN  (Personal Access Token de tu cuenta Supabase)
  o    SUPABASE_SERVICE_KEY    (service_role key del proyecto — intento alternativo)
"""
import os, sys, json, urllib.request, urllib.error

PROJECT_REF = "hodrfonbpmqulkyzrzpq"
MGMT_URL    = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
SQL_FILE    = os.path.join(os.path.dirname(__file__), "..", "assets", "admin-schema.sql")

# ── Buscar token ─────────────────────────────────────────────────────────────
token = (os.environ.get("SUPABASE_ACCESS_TOKEN") or
         os.environ.get("SUPABASE_SERVICE_KEY") or "").strip()

print("=" * 60)
print("  MTX Admin Schema Deploy")
print("=" * 60)
print(f"  PROJECT_REF : {PROJECT_REF}")
print(f"  TOKEN set   : {'✅ sí (' + str(len(token)) + ' chars)' if token else '❌ NO'}")
print(f"  TOKEN prefix: {token[:20]}..." if token else "  TOKEN prefix: (vacío)")
print()

if not token:
    print("❌ No se encontró SUPABASE_ACCESS_TOKEN ni SUPABASE_SERVICE_KEY.")
    print()
    print("Para configurar:")
    print("  1. Ve a https://supabase.com/dashboard/account/tokens")
    print("  2. Crea un Personal Access Token")
    print("  3. En GitHub > Settings > Secrets > Actions agrega:")
    print("     Nombre: SUPABASE_ACCESS_TOKEN")
    print("     Valor:  <el token generado>")
    sys.exit(1)

# ── Verificar acceso a Management API ────────────────────────────────────────
print("🔑 Verificando acceso a Supabase Management API...")
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{PROJECT_REF}",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        proj = json.loads(resp.read())
        print(f"✅ Proyecto: {proj.get('name', PROJECT_REF)} ({proj.get('region','?')})\n")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"❌ HTTP {e.code} al verificar proyecto:")
    print(f"   {body[:400]}")
    print()
    if e.code == 401:
        print("→ El token es inválido. Necesitas un Personal Access Token de:")
        print("  https://supabase.com/dashboard/account/tokens")
        print("  (NO es la service_role key del proyecto)")
    elif e.code == 403:
        print("→ El token no tiene permisos sobre este proyecto.")
    sys.exit(1)
except Exception as ex:
    print(f"❌ Error de conexión: {ex}")
    sys.exit(1)

# ── Leer SQL ─────────────────────────────────────────────────────────────────
sql_path = os.path.realpath(SQL_FILE)
if not os.path.exists(sql_path):
    print(f"❌ Archivo no encontrado: {sql_path}")
    sys.exit(1)

with open(sql_path, "r", encoding="utf-8") as f:
    raw_sql = f.read()

# ── Ejecutar SQL completo en un solo request ──────────────────────────────────
# La Management API soporta scripts multi-statement
print(f"📄 SQL: {sql_path}")
print(f"   {len(raw_sql)} caracteres, ejecutando como script único...\n")

data = json.dumps({"query": raw_sql}).encode("utf-8")
req = urllib.request.Request(
    MGMT_URL,
    data=data,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode()
        print("✅ Script ejecutado exitosamente.")
        try:
            parsed = json.loads(body)
            print(f"   Respuesta: {json.dumps(parsed)[:300]}")
        except Exception:
            print(f"   Raw: {body[:300]}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"⚠️  HTTP {e.code} — intentando sentencia por sentencia...")
    print(f"   Error: {body[:300]}\n")
    # Fallback: ejecutar sentencia por sentencia
    errors = 0
    stmts = [s.strip() for s in raw_sql.split(";") if s.strip() and not s.strip().startswith("--")]
    print(f"   {len(stmts)} sentencias...")
    for i, stmt in enumerate(stmts, 1):
        stmt_full = stmt + ";"
        d2 = json.dumps({"query": stmt_full}).encode("utf-8")
        r2 = urllib.request.Request(MGMT_URL, data=d2,
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(r2, timeout=30) as rr:
                pass  # OK
        except urllib.error.HTTPError as e2:
            b2 = e2.read().decode()
            label = stmt_full[:60].replace("\n"," ")
            print(f"  [{i}] ⚠️  {label}...")
            print(f"       HTTP {e2.code}: {b2[:200]}")
            errors += 1
    print(f"\n  Completado con {errors} advertencias.")

# ── Verificar tablas ─────────────────────────────────────────────────────────
print("\n🔍 Verificando tablas...")
check_sql = """SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN ('suppliers','requisitions','purchase_orders',
'supplier_quotes','invoices_out','invoices_in','payments','contracts')
ORDER BY table_name"""

d3 = json.dumps({"query": check_sql}).encode("utf-8")
r3 = urllib.request.Request(MGMT_URL, data=d3,
    headers={"Authorization": f"Bearer {token}",
             "Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(r3, timeout=20) as rr:
        body3 = rr.read().decode()
        rows = json.loads(body3)
        tables = [r[0] if isinstance(r, list) else r.get("table_name","?") for r in rows]
        expected = {"suppliers","requisitions","purchase_orders","supplier_quotes",
                    "invoices_out","invoices_in","payments","contracts"}
        print()
        for t in sorted(expected):
            print(f"  {'✅' if t in set(tables) else '❌'} {t}")
        missing = expected - set(tables)
        if missing:
            print(f"\n❌ Faltantes: {missing}")
            sys.exit(1)
        print("\n✅ Todos los módulos activos.")
except Exception as ex:
    print(f"  (no se pudo verificar: {ex})")
