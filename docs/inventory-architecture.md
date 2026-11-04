# Arquitectura del inventario BioMedGest

## Alcance y compatibilidad

El módulo amplía el esquema existente sin reemplazar `profiles`, `reports`, `maintenances` ni `maintenance_activities`. La tabla `maintenances` sigue siendo la cabecera operativa de una orden de servicio. La vista `service_orders` presenta ese significado a la aplicación sin renombrar ni romper el módulo actual.

El Excel conserva su trazabilidad mediante `inventory_import_batches`, `source_sheet` y `source_row`. Cada activo recibe un UUID interno y un código estable `EQ-000001` a `EQ-000100`; el número de serie no se usa como llave porque existen valores `S/N` y un duplicado confirmado en la fuente.

## Relaciones principales

```text
profiles
  ├─ reports ───────────────┐
  ├─ maintenances ──────────┼─ equipment_assets
  │    ├─ maintenance_activities
  │    ├─ maintenance_records
  │    └─ maintenance_evidence
  └─ risk_assessments       │
                            │
hospital_areas ─ equipment_locations
        └──────────── equipment_assets

equipment_types ─ equipment_models ─ manufacturers
                         └────────── equipment_assets

equipment_assets ─ equipment_document_links ─ equipment_documents
equipment_assets ─ equipment_maintenance_programs ─ maintenance_programs
equipment_assets ─ risk_assessments
inventory_import_batches ─ inventory_import_issues
```

## Decisiones de normalización

- `equipment_assets` representa el activo físico; nunca se identifica por número de serie.
- Tipo, fabricante y modelo son catálogos separados. Un modelo pertenece a un tipo y fabricante.
- El área hospitalaria se conserva aunque falte la ubicación específica.
- Los documentos se deduplican por tipo y URL normalizada, y se enlazan a varios activos.
- Las 44 rutinas normalizadas se almacenan como programas. La relación muchos-a-muchos permite reutilizarlas.
- La periodicidad queda nula y marcada para revisión; `Final.xlsx` no aporta una frecuencia confiable.
- Cada evaluación pertenece a un activo. No se asigna riesgo fijo al tipo porque camas y humidificadores presentan más de una evaluación válida.
- El total de riesgo se recalcula en PostgreSQL y una restricción impide guardar una categoría incompatible.
- Los datos dudosos no se corrigen ni eliminan automáticamente. Se conservan en el activo y en `inventory_import_issues`.

## Integración con módulos existentes

- `reports.equipment_id` sustituirá gradualmente `equipment_identifier`; el campo de texto se conserva durante la transición.
- `maintenances.equipment_id` enlaza cada orden con el activo y `maintenance_program_id` registra el programa que la originó.
- `maintenance_records` contiene diagnóstico, trabajo realizado, pruebas y condición final.
- `maintenance_evidence` guarda únicamente metadatos y rutas de Storage. No almacena archivos binarios en PostgreSQL.
- La vista `service_orders` permite que la interfaz use terminología de órdenes sin cambiar la tabla existente.

## Autorización por rol

| Operación | Usuario clínico | Técnico | Jefe |
| --- | --- | --- | --- |
| Buscar equipo por código, tipo o área | Sí, mediante RPC limitada | Sí | Sí |
| Ver serie, manuales, riesgo y programa | No | Sí | Sí |
| Crear o editar activos y catálogos | No | No | Sí |
| Reportar una falla | Sí | Sí | Sí |
| Ver reportes ajenos | Solo propios | Solo vinculados a órdenes asignadas | Sí |
| Actualizar una orden | No | Solo estado de órdenes asignadas mediante RPC | Sí |
| Registrar actividades y evidencias | No | Solo órdenes asignadas | Sí |
| Revisar incidencias de importación | No | No | Sí |

La función `search_equipment_directory` expone únicamente los campos necesarios para identificar un equipo. Las tablas completas quedan protegidas por RLS para técnico y jefe. Esto evita depender de botones ocultos en la interfaz.

## Integración prevista con React

`src/lib/supabase.ts` incluye `searchEquipmentDirectory()` para los tres roles y `getEquipmentInventoryDetail()` para técnico/jefe. La pantalla `Inventory` debe reemplazar el estado pendiente con:

1. búsqueda con demora corta y llamada a `searchEquipmentDirectory`;
2. tabla o tarjetas adaptables con código, tipo, marca, modelo, área, ubicación y estado;
3. selección de un UUID para abrir `EquipmentDetail`;
4. detalle completo solo para técnico/jefe;
5. acciones de alta/edición únicamente para jefe;
6. creación de reportes usando `equipment_id`, manteniendo temporalmente el texto heredado.

El cableado visual se deja para después de aprobar y probar el esquema en una base local, evitando construir una interfaz sobre contratos de datos aún no desplegados.

## Orden de migración propuesto

1. `00_core.sql`
2. `01_users.sql`
3. `02_inventory.sql`
4. `03_maintenance.sql`
5. `04_reports.sql`
6. `07_training.sql`
7. `08_quotes.sql`
8. `09_audit.sql`
9. `10_access_requests.sql`
10. `11_inventory_relations.sql`
11. `05_security.sql`
12. `12_inventory_security.sql`
13. `data/inventory/generated/inventory_import.sql`, solo después de aprobar el reporte de incidencias

Ninguno de estos scripts ha sido ejecutado contra Supabase.
