# Integración frontend del inventario

El módulo de inventario consume únicamente datos de Supabase. No incluye equipos demostrativos ni activa una fuente alternativa cuando la conexión falla.

## Configuración

Crear `.env.local` a partir de `.env.example` y definir solamente las credenciales públicas:

```dotenv
VITE_SUPABASE_URL=https://proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=clave-publica-anon
```

Nunca se debe colocar la clave `service_role` en el frontend.

## Comportamiento por rol

| Funcionalidad | usuario | tecnico | jefe |
|---|---:|---:|---:|
| Buscar y consultar directorio básico | Sí | Sí | Sí |
| Ver número de serie y años | No | Sí | Sí |
| Filtrar y consultar riesgo | No | Sí | Sí |
| Consultar manuales | No | Sí | Sí |
| Consultar rutinas | No | Sí | Sí |
| Consultar incidencias de importación | No | No | Sí |

La interfaz oculta las funciones no autorizadas, pero la protección efectiva permanece en las funciones SQL y las políticas RLS.

## Consultas

- `search_equipment_directory`: directorio limitado disponible para cualquier perfil activo.
- `search_equipment_inventory`: inventario técnico con búsqueda y filtros, restringido a `tecnico` y `jefe`.
- `equipment_inventory_detail`: ficha técnica restringida por RLS.
- `risk_assessments`, `equipment_document_links` y `equipment_maintenance_programs`: se consultan al abrir una ficha técnica.
- `inventory_import_issues`: se consulta únicamente para `jefe` y solo muestra incidencias pendientes del equipo.

Los enlaces documentales se abren solamente cuando usan HTTP o HTTPS. Las direcciones inválidas permanecen visibles como pendientes de revisión, pero no se convierten en enlaces ejecutables.

## Ejecución local

```powershell
pnpm install
pnpm dev
```

Sin variables de Supabase, la aplicación muestra un estado explícito de configuración pendiente. Con variables válidas pero sin las migraciones o datos, mostrará el error o estado vacío recibido; no sustituirá información con mocks.

## Pruebas

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Las pruebas automatizadas usan dependencias inyectadas exclusivamente dentro del entorno de pruebas para comprobar consultas, permisos y estados visuales. Esos mocks no forman parte del funcionamiento de producción.

## Datos demostrativos fuera de este módulo

El inventario y su ficha ya no muestran datos demostrativos. Continúan siendo maquetas, fuera del alcance de esta integración, los indicadores y gráficas de los tableros, la tabla `orders`, la agenda del técnico, los reportes recientes del usuario, el formulario de orden de servicio y el checklist eléctrico de `App.tsx`. Deben conectarse a Supabase en etapas posteriores antes de considerarlos funcionales.
