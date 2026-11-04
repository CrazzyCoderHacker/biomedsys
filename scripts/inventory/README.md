# Importación reproducible de inventario

Este proceso lee `Final.xlsx` en modo de solo lectura. No modifica el archivo fuente ni se conecta a Supabase.

## Preparación

```powershell
python -m venv .venv-inventory
.\.venv-inventory\Scripts\python -m pip install -r scripts\inventory\requirements.txt
```

## Generar el paquete

```powershell
.\.venv-inventory\Scripts\python scripts\inventory\extract_inventory.py C:\ruta\a\Final.xlsx --output-dir data\inventory\generated
```

Se generan CSV de activos, riesgos, documentos, programas y problemas de calidad, un manifiesto con SHA-256 y un `inventory_import.sql` transaccional. El SQL conserva el renglón original, no elimina duplicados y deja los casos dudosos como pendientes de revisión.

Antes de cualquier ejecución remota:

1. Revisar `inventory_review_issues.csv`.
2. Resolver o aceptar explícitamente cada error y advertencia.
3. Probar las migraciones en una base local desechable.
4. Obtener aprobación para ejecutar migraciones e importación.

El orden futuro de ejecución está documentado en `supabase/schema.sql`. Codex no ha ejecutado ninguno de estos archivos contra una base remota.

## Pruebas

```powershell
$env:BIOMEDGEST_INVENTORY_XLSX='C:\ruta\a\Final.xlsx'
.\.venv-inventory\Scripts\python -m unittest discover -s scripts\inventory -p 'test_*.py' -v
```

## Validación integral con PostgreSQL local

El siguiente comando crea un clúster temporal aislado en la carpeta temporal de Windows, genera de nuevo el paquete desde el Excel, aplica todos los módulos SQL, importa los datos y prueba las políticas de `usuario`, `tecnico` y `jefe`. Después repite migraciones e importación para comprobar idempotencia y elimina el entorno desechable.

```powershell
.\scripts\inventory\validate_local_postgres.ps1 -SourceXlsx 'C:\ruta\a\Final.xlsx'
```

Requiere PostgreSQL 17 y Python con las dependencias de `requirements.txt`. No usa conexiones remotas. Para conservar temporalmente el clúster y sus registros de diagnóstico, agregue `-KeepData`.
