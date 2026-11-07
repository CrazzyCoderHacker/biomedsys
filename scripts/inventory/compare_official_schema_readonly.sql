\set ON_ERROR_STOP on

-- REL-01: inventario de catálogo estrictamente de solo lectura.
-- Ejecutar en el SQL Editor del proyecto oficial y descargar el resultado.
begin transaction read only;

select jsonb_build_object(
  'database', current_database(),
  'base_tables', (select count(*) from pg_tables where schemaname = 'public'),
  'views', (select count(*) from pg_views where schemaname = 'public'),
  'table_like_relations', (
    select count(*) from information_schema.tables where table_schema = 'public'
  ),
  'rls_tables', (
    select count(*) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
  ),
  'functions', (
    select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
  ),
  'triggers', (
    select count(*) from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
  ),
  'policies', (select count(*) from pg_policies where schemaname = 'public')
) as schema_summary;

with local_tables(name) as (values
  ('audit_log'), ('equipment_assets'), ('equipment_document_links'),
  ('equipment_documents'), ('equipment_locations'),
  ('equipment_maintenance_programs'), ('equipment_models'), ('equipment_types'),
  ('hospital_areas'), ('inventory_import_batches'), ('inventory_import_issues'),
  ('inventory_issue_reviews'), ('maintenance_activities'), ('maintenance_catalog'),
  ('maintenance_evidence'), ('maintenance_programs'), ('maintenance_records'),
  ('maintenances'), ('manufacturers'), ('profiles'), ('quotes'),
  ('reports'), ('risk_assessments'), ('training_participants'), ('trainings'),
  ('user_access_requests')
), remote_tables as (
  select tablename as name from pg_tables where schemaname = 'public'
)
select coalesce(l.name, r.name) as object_name,
       case
         when l.name is not null and r.name is not null then 'shared'
         when l.name is not null then 'missing_remote'
         else 'remote_only_review_history'
       end as comparison
from local_tables l
full join remote_tables r using (name)
order by comparison, object_name;

with local_views(name) as (values ('equipment_inventory_detail'), ('service_orders')),
remote_views as (select viewname as name from pg_views where schemaname = 'public')
select coalesce(l.name, r.name) as object_name,
       case
         when l.name is not null and r.name is not null then 'shared_view'
         when l.name is not null then 'missing_remote_view'
         else 'remote_only_view_review_history'
       end as comparison
from local_views l
full join remote_views r using (name)
order by comparison, object_name;

select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       jsonb_agg(
         jsonb_build_object(
           'column', a.attname,
           'type', format_type(a.atttypid, a.atttypmod),
           'not_null', a.attnotnull,
           'default', pg_get_expr(d.adbin, d.adrelid)
         ) order by a.attnum
       ) as columns
from pg_class c
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
group by c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relname;

select conrelid::regclass::text as table_name,
       conname,
       contype,
       pg_get_constraintdef(oid, true) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
order by table_name, conname;

select p.oid::regprocedure::text as function_signature,
       p.prosecdef as security_definer,
       r.rolname as owner,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       md5(pg_get_functiondef(p.oid)) as definition_md5
from pg_proc p
join pg_roles r on r.oid = p.proowner
where p.pronamespace = 'public'::regnamespace
order by function_signature;

select c.relname as table_name,
       t.tgname as trigger_name,
       p.oid::regprocedure::text as function_signature,
       pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
order by c.relname, t.tgname;

select tablename, policyname, permissive, roles, cmd,
       qual as using_expression,
       with_check as check_expression
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Resuelve la ambigüedad del HTTP 200 vacío sin ejecutar ninguna RPC.
select p.oid::regprocedure::text as function_signature,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       p.prosecdef as security_definer
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in (
    'search_equipment_directory',
    'search_equipment_inventory',
    'update_assigned_maintenance_status',
    'schedule_preventive_maintenance'
  )
order by function_signature;

rollback;
