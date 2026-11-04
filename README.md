# BioMedGest

Aplicación web de gestión de equipamiento médico, creada con React, TypeScript, Tailwind CSS 4 y Vite.

## Ejecutar localmente

Se recomienda Node.js 22 o superior y pnpm 10.

```bash
corepack enable
pnpm install
pnpm dev
```

Para generar la versión de producción:

```bash
pnpm build
pnpm preview
```

La aplicación incluye un manifiesto web y un service worker para uso como PWA.

> La página conserva `noindex, nofollow`, ya que así estaba configurada en el proyecto de origen. Si se publica como sitio público, revisa esta opción en `index.html`.

## Supabase y PostgreSQL

La persistencia usa la base PostgreSQL administrada por Supabase. El cliente web solo utiliza la URL y la clave pública (`anon`); nunca agregues una `service_role` al frontend.

1. Crea un proyecto en Supabase.
2. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Ejecuta los scripts SQL en orden desde el SQL Editor de Supabase:
   - [`00_core.sql`](./supabase/00_core.sql)
   - [`01_users.sql`](./supabase/01_users.sql)
   - [`02_inventory.sql`](./supabase/02_inventory.sql) — catálogos, activos, documentos, riesgos y programas preventivos.
   - [`03_maintenance.sql`](./supabase/03_maintenance.sql)
   - [`04_reports.sql`](./supabase/04_reports.sql)
   - [`07_training.sql`](./supabase/07_training.sql)
   - [`08_quotes.sql`](./supabase/08_quotes.sql)
   - [`09_audit.sql`](./supabase/09_audit.sql)
   - [`10_access_requests.sql`](./supabase/10_access_requests.sql)
   - [`11_inventory_relations.sql`](./supabase/11_inventory_relations.sql) — enlaza inventario con reportes y órdenes.
   - [`05_security.sql`](./supabase/05_security.sql) — ejecutar al final, después de crear todas las tablas.
   - [`12_inventory_security.sql`](./supabase/12_inventory_security.sql) — permisos del inventario para usuario, técnico y jefe.
   - [`13_inventory_administration.sql`](./supabase/13_inventory_administration.sql) — administración auditada, periodicidad por equipo y revisión de incidencias. Requiere aprobación separada antes de activar sus controles en el frontend.

   [`schema.sql`](./supabase/schema.sql) funciona como índice y define el orden. Los módulos tienen scripts separados para poder evolucionar usuarios, inventario, mantenimientos, reportes y futuras áreas sin mezclar cambios.
4. En Authentication > Users crea cada cuenta con el correo técnico `<ID_DE_8_DIGITOS>@biomedgest.local` y su contraseña. Después vuelve a ejecutar [`01_users.sql`](./supabase/01_users.sql); su bloque final enlaza automáticamente los tres usuarios Auth con sus perfiles:

```sql
insert into public.profiles (id, institutional_id, full_name, role, department)
values ('UUID_DEL_USUARIO_AUTH', '00123456', 'Ana Martínez', 'jefe', 'Ingeniería Clínica');
```

Para los usuarios iniciales, crea estas cuentas Auth. Define una contraseña temporal distinta en cada cuenta desde el panel de Supabase:

```text
00123456@biomedgest.local / contraseña elegida / jefe
01123456@biomedgest.local / contraseña elegida / tecnico
02123456@biomedgest.local / contraseña elegida / usuario
```

Finalmente ejecuta [`06_verify_demo_users.sql`](./supabase/06_verify_demo_users.sql) para confirmar que los tres perfiles quedaron vinculados. Las contraseñas se crean en Supabase Auth, no mediante `public.profiles` ni insertando directamente en `auth.users`.

Los prefijos admitidos son `00` para jefe, `01` para ingeniero biomédico y `02` para enfermería/médico. Las contraseñas las administra Supabase Auth y los reportes se insertan desde la interfaz autenticada. `reports.maintenance_id` permite relacionar un reporte con una orden de mantenimiento cuando exista; `equipment_identifier` se mantiene como texto temporal hasta que se defina el documento de inventario.

El inventario de `Final.xlsx` se prepara de forma reproducible con [`scripts/inventory`](./scripts/inventory/README.md). El proceso genera archivos de revisión y SQL, pero no ejecuta migraciones ni importa datos automáticamente. Consulta la [arquitectura del inventario](./docs/inventory-architecture.md) antes de aprobar una importación.
