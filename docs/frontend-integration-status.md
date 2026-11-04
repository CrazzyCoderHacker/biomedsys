# Estado de integración del frontend

Fecha de revisión: 4 de noviembre de 2026.

## Funcionalidades conectadas

| Módulo | Estado | Fuente real |
| --- | --- | --- |
| Sesión y perfil | Conectado | Supabase Auth y `profiles` |
| Dashboard de jefe | Conectado | RPC de inventario, `reports` y `maintenances` |
| Dashboard de técnico y usuario | Conectado | Registros visibles por RLS en `reports` y `maintenances` |
| Inventario | Conectado | `search_equipment_directory` y `search_equipment_inventory` |
| Ficha técnica | Conectado | Vista `equipment_inventory_detail` |
| Riesgos | Conectado | `risk_assessments` |
| Manuales por equipo | Conectado | `equipment_documents` y `equipment_document_links` |
| Rutinas por equipo | Conectado | `maintenance_programs` y `equipment_maintenance_programs` |
| Incidencias de importación | Conectado para jefe | `inventory_import_issues` |
| Mesa de ayuda | Conectado | Lectura y creación mediante `reports`; vincula `equipment_id` cuando el código coincide |
| Mantenimiento y órdenes | Lectura conectada | `maintenance_catalog` y `maintenances` |
| Biblioteca de documentos | Conectada | `equipment_documents` y conteo de vínculos |
| Usuarios | Lectura conectada | `profiles` |
| Trazabilidad | Lectura conectada | `audit_log` |
| Cotizaciones | Conectada | `quotes` |
| Capacitaciones y avisos | Conectados | `trainings` |

Las vistas no sustituyen errores de Supabase por arreglos ficticios. Los fallos de consulta aparecen como estados de error y las tablas sin registros muestran estados vacíos.

## Funcionalidades pendientes

| Funcionalidad | Motivo |
| --- | --- |
| Alta y administración de cuentas | Requiere un flujo administrativo seguro; no debe hacerse desde el navegador con claves privilegiadas. |
| Escaneo QR | No existe integración con cámara o lector. El control aparece deshabilitado. |
| Adjuntos de reportes | No existen bucket ni políticas de Storage aprobadas. |
| Cálculo automático de prioridad | No existe una regla o RPC aprobada. Los reportes nuevos conservan la prioridad inicial definida por la base. |
| Objetivos SLA | El esquema no almacena objetivos ni vencimientos. El dashboard no calcula porcentajes inventados. |
| Programación desde el calendario | La lectura es real, pero crear mantenimientos requiere un formulario y validaciones aprobados. |
| Expediente técnico, mediciones y evidencias | Existen tablas base, pero falta el flujo completo y Storage para archivos. |
| Edición de incidencias del Excel | Se mantiene solo lectura hasta autorizar cambios de revisión. |

## Verificación local

- `npx tsc --noEmit`: correcto.
- `npm test`: 15 pruebas correctas.
- `npm run build`: correcto.
- Servidor Vite: respuesta HTTP 200 en `http://127.0.0.1:5173/`.
- `.env.local`: URL del proyecto `yvqccoavcwfzcxrfvsjs` confirmada; Auth respondió HTTP 200 con la clave pública.

Las pruebas autenticadas contra datos reales deben ejecutarse con la cuenta temporal autorizada. No se almacenan contraseñas en el repositorio ni en las pruebas.
