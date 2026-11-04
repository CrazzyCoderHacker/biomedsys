\set ON_ERROR_STOP on

-- Read-only deployment gate for the official BioMedGest project.
-- Run only after a verified backup and explicit deployment approval.

do $$
declare
  expected_tables text[] := array[
    'audit_log',
    'maintenance_activities',
    'maintenance_catalog',
    'maintenances',
    'profiles',
    'quotes',
    'reports',
    'training_participants',
    'trainings',
    'user_access_requests'
  ];
  inventory_tables text[] := array[
    'equipment_assets',
    'equipment_document_links',
    'equipment_documents',
    'equipment_locations',
    'equipment_maintenance_programs',
    'equipment_models',
    'equipment_types',
    'hospital_areas',
    'inventory_import_batches',
    'inventory_import_issues',
    'maintenance_evidence',
    'maintenance_programs',
    'maintenance_records',
    'manufacturers',
    'risk_assessments'
  ];
  actual_tables text[];
  existing_inventory_tables text[];
  existing_bridge_columns text[];
  conflicting_policies text[];
  policy_count integer;
  rls_table_count integer;
begin
  select array_agg(c.relname order by c.relname)
  into actual_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  if actual_tables is distinct from expected_tables then
    raise exception 'Preflight aborted: public table set drifted. Expected %, found %',
      expected_tables, actual_tables;
  end if;

  select array_agg(c.relname order by c.relname)
  into existing_inventory_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(inventory_tables)
    and c.relkind in ('r', 'v', 'm');

  if existing_inventory_tables is not null then
    raise exception 'Preflight aborted: inventory objects already exist: %', existing_inventory_tables;
  end if;

  select array_agg(format('%I.%I', table_name, column_name) order by table_name, column_name)
  into existing_bridge_columns
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'reports' and column_name = 'equipment_id') or
      (table_name = 'maintenances' and column_name in (
        'equipment_id', 'maintenance_program_id', 'priority', 'completed_at'
      ))
    );

  if existing_bridge_columns is not null then
    raise exception 'Preflight aborted: bridge columns already exist: %', existing_bridge_columns;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_manager'
  ) then
    raise exception 'Preflight aborted: public.is_manager is missing';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    raise exception 'Preflight aborted: public.rls_auto_enable is missing';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'has_active_profile',
        'is_technician_or_manager',
        'search_equipment_directory',
        'search_equipment_inventory',
        'set_inventory_updated_at',
        'update_assigned_maintenance_status'
      )
  ) then
    raise exception 'Preflight aborted: one or more inventory functions already exist';
  end if;

  if to_regclass('public.equipment_inventory_detail') is not null
    or to_regclass('public.service_orders') is not null then
    raise exception 'Preflight aborted: an inventory view already exists';
  end if;

  select count(*) into policy_count
  from pg_policies where schemaname = 'public';
  if policy_count <> 16 then
    raise exception 'Preflight aborted: expected 16 public policies, found %', policy_count;
  end if;

  select count(*) into rls_table_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;
  if rls_table_count <> 10 then
    raise exception 'Preflight aborted: expected RLS on 10 public tables, found %', rls_table_count;
  end if;

  select array_agg(policyname order by policyname)
  into conflicting_policies
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'assigned technicians create activities',
      'assigned technicians read linked reports',
      'assigned technicians update activities',
      'managers update maintenances'
    );

  if conflicting_policies is not null then
    raise exception 'Preflight aborted: planned policy names already exist: %', conflicting_policies;
  end if;
end
$$;

select jsonb_build_object(
  'database', current_database(),
  'public_tables', (select count(*) from pg_tables where schemaname = 'public'),
  'public_policies', (select count(*) from pg_policies where schemaname = 'public'),
  'profiles', (select count(*) from public.profiles),
  'reports', (select count(*) from public.reports),
  'maintenances', (select count(*) from public.maintenances),
  'maintenance_activities', (select count(*) from public.maintenance_activities),
  'auth_users', (select count(*) from auth.users),
  'rls_auto_enable_preserved', exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  )
) as official_inventory_preflight;
