# Validación técnica local del inventario

Fecha de ejecución: 3 de noviembre de 2026  
Rama: `feat/inventory-module`  
Fuente: `Final.xlsx` (solo lectura)  
Entorno: PostgreSQL 17.6 local, aislado en `127.0.0.1:55432`

No se usó Supabase Cloud, no se modificó una base remota y no se alteró el Excel original.

## Resultado ejecutivo

La migración completa, la importación y las pruebas funcionales terminaron correctamente. Una segunda ejecución de todas las migraciones y del importador no produjo errores ni duplicaciones. Durante la validación se detectaron y corrigieron dos debilidades del diseño: la ubicación ahora debe pertenecer al área asignada al equipo y un técnico ya no puede eliminar registros de mantenimiento.

## Resultados por prueba

| Prueba | Resultado | Evidencia |
|---|---|---|
| Entorno local | Aprobada | PostgreSQL 17.6 instalado; se creó una base desechable separada del servicio existente. Docker, Podman y WSL no estaban disponibles y no fue necesario instalarlos. |
| Aplicación de SQL | Aprobada | Todos los módulos se aplicaron con detención inmediata ante errores. |
| Estructura | Aprobada | 40 llaves foráneas, 37 restricciones `CHECK`, 22 restricciones únicas, 25 tablas con RLS y 51 políticas. |
| Importación | Aprobada | 100 equipos y 100 evaluaciones de riesgo conservados. |
| Mantenimiento | Aprobada | 44 programas normalizados y 100 relaciones equipo–programa. |
| Documentos | Aprobada | 111 documentos únicos y 199 relaciones equipo–documento. |
| Reportes | Aprobada | Un usuario creó y consultó su reporte ligado a un equipo mediante el directorio permitido. |
| Órdenes de servicio | Aprobada | Un jefe creó una orden relacionada con reporte y equipo; el técnico asignado pudo consultarla y actualizar su estado. |
| Rol `usuario` | Aprobada | Acceso al directorio limitado por función; sin lectura directa ni modificación de las tablas maestras. |
| Rol `tecnico` | Aprobada | Lectura de inventario y órdenes asignadas; sin cambios al inventario ni eliminación de registros técnicos. |
| Rol `jefe` | Aprobada | Acceso integral al inventario y flujo de asignación de órdenes. |
| Integridad área–ubicación | Aprobada | Se rechazó asignar a un equipo una ubicación de otra área. |
| Idempotencia | Aprobada | Segunda ejecución completa sin errores; los conteos no cambiaron. |

Las sesiones de los tres roles se probaron con el rol PostgreSQL `authenticated`, un identificador de usuario simulado y las políticas RLS activas. Las operaciones no se realizaron como propietario de las tablas ni con privilegios administrativos.

## Conteos finales

| Entidad | Total |
|---|---:|
| Equipos | 100 |
| Evaluaciones de riesgo | 100 |
| Programas de mantenimiento | 44 |
| Relaciones equipo–programa | 100 |
| Documentos únicos | 111 |
| Relaciones equipo–documento | 199 |
| Incidencias conservadas | 162 |

## Revisión de los totales de riesgo

En `Hoja2`, dentro de los 100 registros de equipos, el campo **Total** de la columna F contiene **90 fórmulas** y **10 valores escritos directamente**. Los valores escritos corresponden a las filas 5 a 14 de la hoja (identificadores 2 a 11). El libro se abrió con fórmulas visibles y en modo de solo lectura, por lo que este conteo no depende de los valores calculados almacenados por Excel.

## Incidencias que requieren decisión

Las dos incidencias clasificadas como error se conservaron sin corregir:

- `EQ-000052`, número de serie `3979000122`, lámpara Mindray HyLED 600.
- `EQ-000053`, número de serie `3979000122`, lámpara Mindray HyLED 600.

Ambos registros permanecen en el inventario y en el reporte de revisión. Se necesita confirmar si representan dos equipos con un serial capturado por duplicado o una duplicación del registro. Además, los 100 equipos no incluyen una periodicidad explícita en el Excel; el importador conserva esta ausencia como advertencia y no inventa intervalos de mantenimiento.

## Alcance y pendientes antes de Supabase Cloud

La prueba valida PostgreSQL, integridad relacional, funciones y RLS. Para representar Supabase localmente se usó un esquema mínimo de `auth.users`, la función `auth.uid()` y los roles `anon`, `authenticated` y `service_role`. No sustituye una última prueba de integración con Auth, PostgREST y Storage reales.

Antes de producción se debe:

1. Resolver o aceptar expresamente los dos seriales duplicados.
2. Definir la periodicidad de los programas que hoy carecen de ella.
3. Probar en un proyecto Supabase de desarrollo, nunca directamente en producción.
4. Configurar y probar las políticas de Storage para los archivos físicos; esta validación cubre los metadatos y relaciones documentales.

## Reproducción

```powershell
.\scripts\inventory\validate_local_postgres.ps1 -SourceXlsx 'C:\ruta\a\Final.xlsx'
```

El script genera el paquete en una carpeta temporal, crea un PostgreSQL local enlazado únicamente a `127.0.0.1`, ejecuta las pruebas funcionales y luego repite las migraciones y la importación, detiene el servidor y elimina el entorno. No contiene credenciales ni conexiones remotas.
