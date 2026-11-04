# Instalación segura del inventario en Supabase

Estado de la revisión: 2026-11-04. Proyecto remoto inspeccionado: `yvqccoavcwfzcxrfvsjs`, rama `main` marcada como producción. Esta guía no autoriza ni ejecuta cambios remotos.

## Preflight remoto ejecutado

El 2026-11-04 el usuario aceptó explícitamente continuar sin respaldo recuperable. Se ejecutó `scripts/inventory/preflight_official_inventory.sql` en modo de solo lectura contra el proyecto oficial. No se ejecutó DDL ni se importaron datos.

Resultado aprobado:

- proyecto `yvqccoavcwfzcxrfvsjs`, base `postgres`;
- 10 tablas públicas y 16 políticas RLS;
- 3 perfiles y 3 usuarios Auth;
- 0 reportes, 0 mantenimientos y 0 actividades de mantenimiento;
- función `rls_auto_enable` presente;
- ninguna tabla, vista, función o columna del inventario instalada parcialmente;
- ninguna colisión con los nombres de políticas que añadirá `12_inventory_security.sql`;
- tipos críticos, llaves primarias, llaves foráneas y enums base compatibles con los SQL locales;
- `is_manager()` existe con firma sin argumentos y retorno booleano.

El preflight fue la puerta de entrada aprobada para la Fase 2 y se repitió inmediatamente antes del primer DDL.

## Fase 2 aplicada en el proyecto oficial

El 2026-11-04 el usuario autorizó la Fase 2 y confirmó el acuerdo del propietario. El preflight se repitió inmediatamente antes del primer DDL. Se ejecutaron, en transacciones independientes y en este orden:

1. `02_inventory.sql`
2. `11_inventory_relations.sql`
3. `12_inventory_security.sql`

Cada transacción incluyó precondiciones y aserciones posteriores; no se produjo ningún error.

Resultado remoto después de las migraciones:

- 25 tablas públicas: las 10 originales y 15 nuevas;
- 51 políticas públicas y RLS habilitado en las 25 tablas;
- 13 tablas del dominio de inventario creadas por `02`;
- `maintenance_records` y `maintenance_evidence` creadas por `11`;
- cinco columnas puente creadas en `reports` y `maintenances`;
- vistas `equipment_inventory_detail` y `service_orders` disponibles;
- funciones de inventario y RPC de seguridad disponibles;
- 3 perfiles y 3 usuarios Auth conservados;
- `rls_auto_enable`, `is_manager`, `set_maintenance_number` y `write_audit_log` conservadas.

Conteos originales verificados después del despliegue:

- `maintenance_catalog`: 3;
- `profiles`: 3;
- `audit_log`, `maintenance_activities`, `maintenances`, `quotes`, `reports`, `training_participants`, `trainings` y `user_access_requests`: 0;
- `auth.users`: 3.

No se ejecutaron los scripts base `00`–`10`, no se importó `Final.xlsx` y todas las tablas nuevas permanecen sin los 100 equipos. La Fase 3 requiere una autorización separada.

## Estado remoto y comparación

El esquema remoto contiene diez tablas públicas: `profiles`, `maintenance_catalog`, `maintenances`, `maintenance_activities`, `reports`, `trainings`, `training_participants`, `quotes`, `audit_log` y `user_access_requests`. Todas tienen RLS habilitado y existen 16 políticas. Las columnas visibles concuerdan con los módulos base `01`, `03`, `04`, `07`, `08`, `09` y `10`; `05_security.sql` concuerda con las políticas existentes. No hay migraciones registradas, por lo que no se debe asumir que esos archivos fueron aplicados por una herramienta de migración.

Funciones remotas existentes: `is_manager`, `set_maintenance_number`, `write_audit_log` y `rls_auto_enable`. La última es exclusiva del entorno remoto y debe conservarse. No hay buckets ni políticas de Storage. Las tablas que recibirían relaciones (`reports`, `maintenances` y `maintenance_activities`) estaban vacías durante la inspección.

Faltan los siguientes objetos del inventario local:

- 13 tablas de `02_inventory.sql`: `hospital_areas`, `equipment_types`, `manufacturers`, `equipment_models`, `equipment_locations`, `inventory_import_batches`, `equipment_assets`, `equipment_documents`, `equipment_document_links`, `maintenance_programs`, `equipment_maintenance_programs`, `risk_assessments` e `inventory_import_issues`.
- Dos tablas de `11_inventory_relations.sql`: `maintenance_records` y `maintenance_evidence`.
- Vistas `equipment_inventory_detail` y `service_orders`.
- Columnas `reports.equipment_id`; `maintenances.equipment_id`, `maintenance_program_id`, `priority` y `completed_at`.
- Funciones `set_inventory_updated_at`, `is_technician_or_manager`, `has_active_profile`, `search_equipment_directory`, `search_equipment_inventory` y `update_assigned_maintenance_status`.
- Las políticas adicionales definidas en `12_inventory_security.sql`.

El SQL no hace único `equipment_assets.serial_number`, por lo que conserva seriales duplicados. `maintenance_programs.interval_months` admite `NULL` y `requires_review` inicia en `true`, por lo que no inventa periodicidades.

## Respaldo obligatorio antes de desplegar

El proyecto está en plan Free y no presenta un respaldo automático descargable. Antes de cualquier DDL se requiere un respaldo lógico manual verificable.

1. Guardar la contraseña de base de datos únicamente en un archivo `pgpass` local, fuera del repositorio, con una entrada `host:port:database:user:password`. No pasar la contraseña por parámetros ni registrarla en el chat.
2. Ejecutar `scripts/inventory/backup_remote_supabase.ps1` indicando host, archivo `pgpass` y una carpeta de salida fuera del repositorio.
3. Conservar los seis artefactos generados: respaldo completo, respaldo restaurable de `public`, esquema SQL, las dos listas de contenido y el archivo SHA-256.
4. Confirmar que `pg_restore --list` terminó correctamente para ambos archivos y que el respaldo completo incluye `public`, `auth` y los datos de usuarios. Si alguna sección no es accesible, detener el despliegue y corregir el método de respaldo.
5. Restaurar como mínimo el respaldo de `public` en PostgreSQL local desechable y repetir conteos antes de considerarlo recuperable. El respaldo completo se conserva además para recuperación coordinada con Supabase. Un archivo generado pero no restaurado no se considera respaldo verificado.

No hay un respaldo remoto verificable disponible todavía: falta ejecutar este procedimiento con acceso de base de datos guardado localmente.

## Entorno objetivo

Por decisión del equipo no se creará otro proyecto. PostgreSQL local desechable seguirá siendo la prevalidación y el proyecto oficial solo se modificará después de verificar el respaldo y recibir aprobación expresa.

## Línea base del esquema existente

No ejecutar `00`–`10` contra el proyecto oficial. Tampoco usar `migration repair` ni insertar filas en el historial de migraciones hasta completar esta equivalencia:

1. Exportar el esquema remoto y tomar huellas de columnas, tipos, nulabilidad, valores por defecto, identidades, PK, FK, `UNIQUE`, `CHECK`, índices, enums, funciones, triggers, RLS y políticas.
2. Comparar cada objeto con `00_core.sql`, `01_users.sql`, `03_maintenance.sql`, `04_reports.sql`, `05_security.sql`, `07_training.sql`, `08_quotes.sql`, `09_audit.sql` y `10_access_requests.sql`.
3. Registrar por escrito cualquier diferencia, incluida `rls_auto_enable`, antes de declarar equivalencia.
4. Crear una instantánea de línea base para control de versiones que describa el estado real, sin DDL recreador y sin ejecutarla en remoto.
5. Solo después de una revisión conjunta decidir si se registra una reparación de historial. La equivalencia de nombres de tabla no es evidencia suficiente.

## Despliegue propuesto

Orden obligatorio:

1. `02_inventory.sql`
2. `11_inventory_relations.sql`
3. `12_inventory_security.sql`

Cada archivo debe ejecutarse con `psql -X --set ON_ERROR_STOP=1 --single-transaction`, desde una conexión guardada localmente. Antes de cualquier DDL debe ejecutarse `scripts/inventory/preflight_official_inventory.sql`; si detecta deriva, objetos parciales, políticas inesperadas o ausencia de `rls_auto_enable`, el despliegue se cancela y vuelve a revisión.

### Cambios que requieren aprobación

`02_inventory.sql`:

- Crear enums `equipment_status`, `risk_level` e `inventory_review_status`.
- Crear 13 tablas, seis índices, la función/trigger de `updated_at` y la vista `equipment_inventory_detail`.
- Dependencia existente: `public.profiles` y `gen_random_uuid()`.
- No importa datos ni modifica usuarios.

`11_inventory_relations.sql`:

- Añadir una FK nullable a `reports`.
- Añadir dos FK nullable, `priority` nullable y `completed_at` a `maintenances`.
- Conservar `priority = NULL` en órdenes antiguas; configurar `DEFAULT 'ordinaria'` únicamente para órdenes nuevas.
- Crear tres índices, `maintenance_records`, `maintenance_evidence`, su trigger y la vista `service_orders`.
- Dependencias: objetos de `02`, más `reports`, `maintenances` y `profiles` existentes.

`12_inventory_security.sql`:

- Crear dos funciones auxiliares de rol y tres RPC de inventario/mantenimiento.
- Habilitar RLS en las 15 tablas nuevas.
- Crear 22 políticas para las 11 tablas de lectura biomédica y 11 de administración, además de las políticas de lotes, incidencias, registros/evidencias y las políticas aditivas sobre `reports`, `maintenances` y `maintenance_activities`.
- Revocar ejecución pública de las tres RPC y concederla a `authenticated`; conceder lectura de las dos vistas.
- Dependencia crítica: `is_manager()` remoto debe conservar su firma y comportamiento.

Ninguno de los tres archivos elimina `rls_auto_enable`, usuarios o perfiles. El preflight preparado aborta si `rls_auto_enable` o `is_manager()` no existen y también si el conjunto de tablas, RLS o políticas ya no coincide con la línea base revisada.

## Verificación y recuperación

Antes del `COMMIT` de cada archivo, validar número y definición de objetos, dependencias, RLS y políticas. Después de los tres archivos, probar con cuentas ordinarias de `usuario`, `tecnico` y `jefe`, nunca con `service_role`. La utilidad `verify_remote_role_logins.mjs` recibe IDs y contraseñas solo mediante variables de proceso y cierra cada sesión.

Si una ejecución falla, `--single-transaction` revierte el archivo completo. Si ya se confirmó una migración y aparece un defecto:

- detener nuevas escrituras del módulo;
- conservar los datos creados para análisis;
- restaurar el respaldo de `public` en PostgreSQL local desechable y verificarlo;
- preferir conmutar a la restauración comprobada antes que ejecutar un `down` destructivo en producción;
- preparar un script de reversión específico solo después de inventariar qué objetos y filas llegaron a crearse.

No importar `Final.xlsx` durante este despliegue. La importación requiere una aprobación separada después de verificar esquema, RLS, RPC y los tres roles.
