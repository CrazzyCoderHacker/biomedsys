# Entorno Supabase Cloud de desarrollo (plan descartado)

Estado: descartado por decisión del usuario el 2026-11-04. No se creó ningún recurso remoto. El despliegue controlado continuará sobre el proyecto oficial únicamente después de un respaldo recuperable y una aprobación expresa.

## Disponibilidad comprobada

- La organización compartida `brz_solutions` usa el plan Free y ya contiene dos proyectos activos. No se utilizará para el entorno de desarrollo.
- La cuenta del desarrollador ofrece crear una organización personal nueva con el plan `Free - $0/month` seleccionado.
- La creación de la organización y del proyecto requiere autorización explícita porque genera recursos persistentes en Supabase.
- En la organización oficial la cuenta tiene rol `Developer`; el propietario conserva el rol `Owner`.

Propuesta de nombres:

- Organización personal: `BioMedGest Development`
- Proyecto: `biomedgest-dev`
- Plan: Free
- Región: la misma del proyecto oficial (`us-east-1`) para reducir diferencias de infraestructura.

## Alcance del entorno

El proyecto de desarrollo no recibirá usuarios, contraseñas, datos privados ni secretos del proyecto oficial. Solo contendrá:

1. El esquema base necesario para BioMedGest.
2. `02_inventory.sql`, `11_inventory_relations.sql` y `12_inventory_security.sql`.
3. Los 100 equipos obtenidos de `Final.xlsx`, conservando incidencias, seriales repetidos y periodicidades desconocidas.
4. Tres usuarios ficticios generados exclusivamente para pruebas: `usuario`, `tecnico` y `jefe`.

Las contraseñas de prueba serán aleatorias, distintas entre sí y guardadas únicamente en variables o archivos locales ignorados por Git. No aparecerán en documentación, commits ni salida de pruebas.

## Secuencia prevista

1. Crear la organización personal y el proyecto Free después de la autorización.
2. Guardar localmente la URL, clave pública y credenciales de conexión del proyecto de desarrollo.
3. Aplicar primero el esquema base en una transacción y verificar sus objetos.
4. Aplicar por separado `02`, `11` y `12`, cada uno con parada ante el primer error.
5. Crear tres cuentas ficticias de Auth y sus perfiles asociados.
6. Ejecutar el importador reproducible de `Final.xlsx` y verificar 100 equipos más riesgos, documentos, rutinas e incidencias.
7. Probar PostgREST y las RPC con la clave pública y sesiones normales, nunca con `service_role` para las pruebas funcionales.
8. Ejecutar la matriz RLS para los tres perfiles y comprobar búsquedas, filtros, ficha técnica, manuales, rutinas e incidencias.
9. Configurar el frontend local contra el proyecto de desarrollo, compilar y repetir las pruebas desde la interfaz.
10. Documentar resultados, conteos y cualquier diferencia con PostgreSQL local.

## Permisos para respaldar el proyecto oficial

El rol remoto actual es `Developer`. Permite administrar contenido del proyecto, pero no modificar sus ajustes ni restablecer la contraseña de base de datos. El script de respaldo necesita:

- host, puerto, base y usuario obtenidos del diálogo `Connect`;
- una credencial PostgreSQL válida guardada localmente mediante `PGPASSFILE`;
- acceso de red al endpoint directo IPv6 o, preferentemente en esta máquina, al Session Pooler IPv4;
- permisos suficientes para leer todos los esquemas y datos que se pretenden recuperar;
- espacio local para el dump y para una restauración de prueba.

Opciones seguras, en orden de preferencia:

1. El propietario configura acceso temporal JIT para esta cuenta, limitado al rol requerido, fecha de expiración y red autorizada. La credencial temporal se guarda localmente y se revoca después de verificar el respaldo.
2. El propietario ejecuta personalmente el script en su equipo y entrega solo los artefactos cifrados y sus hashes.
3. Como último recurso, el propietario introduce la contraseña PostgreSQL en un archivo `pgpass` local en este equipo, sin enviarla por chat ni incluirla en comandos o Git.

El respaldo no se considerará recuperable hasta restaurarlo en una base desechable y comparar esquema, conteos, funciones, RLS y usuarios. El dump estándar de Supabase CLI excluye esquemas administrados como `auth` y `storage`; por eso debe definirse explícitamente si la recuperación requerida cubre solo el esquema de aplicación o también Auth y metadatos de Storage.

