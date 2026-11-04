# Administración del inventario y mantenimiento preventivo

## Decisión de diseño

Los 100 activos importados siguen siendo registros independientes. En particular, `EQ-000052` y `EQ-000053` conservan el número de serie compartido `3979000122`; el sistema lo presenta como una incidencia por verificar y no fusiona ni elimina ninguno.

La periodicidad preventiva se configura en la relación `equipment_maintenance_programs`, no en `maintenance_programs`. Así, una rutina reutilizable puede tener una frecuencia distinta para cada equipo sin inventar ni cambiar en bloque las periodicidades ausentes del Excel.

## Migración propuesta

[`13_inventory_administration.sql`](../supabase/13_inventory_administration.sql) es aditiva y no importa ni actualiza datos por sí sola. Añade:

- configuración preventiva por equipo: intervalo, fundamento, notas, fechas base y próximo vencimiento;
- `inventory_issue_reviews`, un historial inmutable de decisiones, justificación y evidencia;
- auditoría de cambios de activos, programas vinculados, incidencias, revisiones y órdenes;
- funciones controladas para editar un activo, configurar su prevención, crear una orden y revisar una incidencia.

Las funciones comprueban `is_manager()` aunque se llamen mediante la API. Usuario y técnico pueden consultar lo que ya permiten las políticas, pero no ejecutar operaciones administrativas. Las órdenes duplicadas para el mismo equipo, rutina y fecha se rechazan dentro de una transacción.

## Activación segura

1. Revisar y aprobar la migración.
2. Ejecutar únicamente `13_inventory_administration.sql` en el proyecto correcto.
3. Comprobar que siguen existiendo 100 activos, 100 riesgos, 44 rutinas, 199 vínculos documentales y 162 incidencias.
4. Probar una sesión de cada rol. Usuario y técnico deben recibir rechazo al intentar las funciones administrativas; jefe debe poder usarlas.
5. Establecer `VITE_INVENTORY_ADMIN_ENABLED=true` en el frontend y reconstruir la aplicación.

Mientras la bandera sea falsa, la ficha del jefe muestra que la administración está pendiente de aprobación y no consulta tablas o funciones de esta migración. El inventario de solo lectura continúa funcionando con el esquema ya desplegado.

## Recuperación

La migración no ofrece una reversión automática porque eliminar columnas o historial sería destructivo. Si se detecta un problema durante su ejecución, debe detenerse sin improvisar cambios. Las funciones, políticas y disparadores pueden deshabilitarse de forma selectiva mediante una migración revisada; los datos de auditoría y revisión deben conservarse.

## Validación local

La prueba desechable se ejecuta con:

```powershell
.\scripts\inventory\validate_local_postgres.ps1 `
  -SourceXlsx 'C:\ruta\Final.xlsx' `
  -PythonExecutable '.\.venv-inventory\Scripts\python.exe'
```

Además de las comprobaciones históricas, valida separación de los dos activos con serie compartida, permisos de los tres roles, periodicidad específica, cálculo del vencimiento, prevención de órdenes duplicadas, historial de revisión, auditoría y una segunda ejecución completa sin duplicaciones.
