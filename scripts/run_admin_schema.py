#!/usr/bin/env python3
"""
run_admin_schema.py
Ejecuta assets/admin-schema.sql en Supabase via Management API.
Requiere: SUPABASE_ACCESS_TOKEN como variable de entorno.
"""
import os
import sys
import json
import urllib.request
import urllib.error

PROJECT_REF = "hodrfonbpmqulkyzrzpq"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
SQL_FILE = os.path.join(os.path.dirname(__file__), "..", "assets", "admin-schema.sql")

def run_query(token, sql, label=""):
    data = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
            print(f"  ✅ {label or 'OK'}")
            return True, body
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ⚠️  {label} — HTTP {e.code}: {body[:300]}")
        return False, body


def split_statements(sql):
    """
    Divide el SQL en sentencias individuales.
    Respeta bloques $$ ... $$ para no partir funciones PL/pgSQL.
    """
    statements = []
    buf = []
    in_dollar = False

    for line in sql.splitlines():
        stripped = line.strip()
        # Contar $$ en la línea para detectar apertura/cierre
        count = stripped.count("$$")
        if count % 2 == 1:
            in_dollar = not in_dollar

        buf.append(line)

        if not in_dollar and stripped.endswith(";"):
            stmt = "\n".join(buf).strip()
            if stmt and not stmt.startswith("--"):
                statements.append(stmt)
            buf = []

    # Cualquier resto
    if buf:
        stmt = "\n".join(buf).strip()
        if stmt and not stmt.startswith("--"):
            statements.append(stmt)

    return statements


def main():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not token:
        print("❌ Variable SUPABASE_ACCESS_TOKEN no definida.")
        sys.exit(1)

    # Verificar token
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            proj = json.loads(resp.read())
            print(f"✅ Conectado al proyecto: {proj.get('name', PROJECT_REF)}")
    except Exception as e:
        print(f"❌ No se pudo autenticar: {e}")
        sys.exit(1)

    # Leer SQL
    sql_path = os.path.realpath(SQL_FILE)
    if not os.path.exists(sql_path):
        print(f"❌ Archivo no encontrado: {sql_path}")
        sys.exit(1)

    with open(sql_path, "r", encoding="utf-8") as f:
        raw_sql = f.read()

    print(f"\n📄 Leyendo {sql_path}")
    stmts = split_statements(raw_sql)
    # Filtrar comentarios puros
    stmts = [s for s in stmts if not all(l.startswith("--") for l in s.strip().splitlines() if l.strip())]
    print(f"📦 {len(stmts)} sentencias a ejecutar\n")

    errors = 0
    for i, stmt in enumerate(stmts, 1):
        # Obtener primera línea no-comentario como etiqueta
        label_line = next(
            (l.strip() for l in stmt.splitlines() if l.strip() and not l.strip().startswith("--")),
            f"stmt_{i}"
        )
        label = label_line[:80]
        ok, _ = run_query(token, stmt, label)
        if not ok:
            errors += 1

    print(f"\n{'═'*50}")
    if errors == 0:
        print("✅ Schema desplegado sin errores.")
    else:
        print(f"⚠️  {errors} sentencias con advertencias (ver arriba).")
        print("   Las advertencias de 'ya existe' son normales en re-ejecuciones.")

    # Verificar tablas
    print("\n🔍 Verificando tablas creadas...")
    ok, body = run_query(
        token,
        """SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name IN ('suppliers','requisitions','purchase_orders',
                                'supplier_quotes','invoices_out','invoices_in',
                                'payments','contracts')
           ORDER BY table_name""",
        "consulta de verificación"
    )
    if ok:
        try:
            rows = json.loads(body)
            tables = [r[0] if isinstance(r, list) else r.get("table_name", "?") for r in rows]
            expected = {"suppliers","requisitions","purchase_orders","supplier_quotes",
                        "invoices_out","invoices_in","payments","contracts"}
            found = set(tables)
            print("\nTablas en Supabase:")
            for t in sorted(expected):
                mark = "✅" if t in found else "❌"
                print(f"  {mark} {t}")
            missing = expected - found
            if missing:
                print(f"\n❌ Faltantes: {missing}")
                sys.exit(1)
            else:
                print("\n✅ Todos los módulos de administración están activos.")
        except Exception as ex:
            print(f"  (no se pudo parsear respuesta: {ex})")
            print(f"  Raw: {body[:500]}")


if __name__ == "__main__":
    main()
