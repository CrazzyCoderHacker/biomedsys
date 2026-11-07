# Supabase Demo de BioMedGest

Este procedimiento instala una demostración independiente. Los scripts se niegan a operar si detectan el proyecto oficial `yvqccoavcwfzcxrfvsjs`.

## 1. Crear y preparar el proyecto

1. Cree un proyecto Supabase separado y gratuito desde el Dashboard. No copie usuarios ni datos del proyecto oficial.
2. En **Authentication > Providers > Email**, deje habilitado Email. Para una demo controlada puede desactivar temporalmente la confirmación de correo.
3. En **Authentication > Users > Add user**, cree estas cuentas con contraseñas distintas, aleatorias y exclusivas de Demo:

   - `00123456@biomedgest.local` — jefe.
   - `01123456@biomedgest.local` — técnico.
   - `02123456@biomedgest.local` — usuario.

No guarde las contraseñas en Git ni las reutilice fuera de Demo.

## 2. Instalar el esquema

El orden reproducible, ya validado en PostgreSQL local, es:

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
11. `05_security.sql` — debe ir después de crear todas las tablas de módulos.
12. `12_inventory_security.sql`
13. `13_inventory_administration.sql`
14. `14_security_hardening.sql`
15. `15_corrective_workflow.sql`
16. `16_operational_completion.sql`
17. `17_training_quotes_completion.sql`
18. `18_final_integration.sql`

No se necesitan `02_inventory_pending.sql` ni `06_verify_demo_users.sql`. El primero quedó sustituido por `02_inventory.sql`; el segundo contiene una comprobación histórica y no crea esquema.

Opción automatizada con la cadena de conexión de **Project Settings > Database**:

```powershell
$env:BIOMEDGEST_DEMO_DATABASE_URL = '<cadena de conexión de Demo>'
.\scripts\demo\install_demo_schema.ps1 -DemoProjectRef '<ref-demo>'
Remove-Item Env:\BIOMEDGEST_DEMO_DATABASE_URL
```

También puede ejecutar los 18 archivos, en ese orden, desde SQL Editor. Luego ejecute:

1. `scripts/demo/seed_synthetic_demo.sql`.
2. `scripts/demo/verify_demo_postflight.sql`.

La semilla es repetible, falla completa si no encuentra las tres cuentas Auth y solo crea un equipo, riesgo y rutina sintéticos. No inventa periodicidad.

Despliegue después las funciones protegidas. `service_role` permanece como secreto administrado por Supabase y nunca se agrega a React:

```powershell
supabase secrets set ALLOWED_ORIGINS='https://su-demo.vercel.app,http://localhost:5173' --project-ref '<ref-demo>'
supabase functions deploy admin-users --project-ref '<ref-demo>'
supabase functions deploy storage-admin --project-ref '<ref-demo>'
```

Puede validar localmente esa instalación desde cero, sin credenciales ni conexión remota, con:

```powershell
.\scripts\demo\validate_demo_local.ps1
```

## 3. Configurar React sin tocar producción

Copie `.env.demo.example` como `.env.demo` y complete únicamente la URL y la clave pública `anon` de Demo. Nunca use `service_role`. Las variables llevan el prefijo `VITE_DEMO_`; la configuración fuerza ese espacio separado y no hereda URL ni clave desde `.env.local` aunque falte algún valor de Demo.

```powershell
Copy-Item .env.demo.example .env.demo
npm run dev:demo
```

Vite usa `.env.demo` solo en modo Demo; `.env.local` no se modifica. Abra la URL mostrada e inicie sesión con el número institucional, sin dominio: `02123456`, `01123456` o `00123456`.

## 4. Ejecutar y verificar el flujo

Para la prueba automatizada E2E, mantenga las contraseñas solo en la sesión de PowerShell:

```powershell
$env:BIOMEDGEST_DEMO_PROJECT_REF = '<ref-demo>'
$env:BIOMEDGEST_DEMO_USER_PASSWORD = '<contraseña temporal usuario>'
$env:BIOMEDGEST_DEMO_TECH_PASSWORD = '<contraseña temporal técnico>'
$env:BIOMEDGEST_DEMO_MANAGER_PASSWORD = '<contraseña temporal jefe>'
npm run verify:demo
```

La prueba crea datos sintéticos persistentes: reporte, orden, intervención y cierre. También verifica historial, notificaciones, carga privada, URL firmada, rechazo de descarga ajena y eliminación compensada en Storage. Exige además rechazo de asignación no autorizada, actualización directa, intervención no autorizada y orden duplicada; después vuelve a leer los registros desde PostgreSQL.

Para verlo en React:

1. Usuario `02123456`: cree un reporte seleccionando `EQ-900001`.
2. Jefe `00123456`: abra **Reportes**, asigne al técnico y genere la orden.
3. Técnico `01123456`: abra **Mantenimiento**, inicie la orden y registre la intervención completa.
4. Jefe: vuelva a **Mantenimiento**, revise el expediente y valide el cierre.
5. Recargue las vistas: el reporte debe quedar `Cerrado` y la orden `completado`.

Al terminar, elimine de la sesión las cuatro variables `BIOMEDGEST_DEMO_*`. `.env.demo` está ignorado por Git.
