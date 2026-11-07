\set ON_ERROR_STOP on

-- Postflight de solo lectura para 14_security_hardening.sql.
-- No cambia perfiles, órdenes ni datos del inventario.
begin transaction read only;

do $$
declare
  function_definition text;
  unsafe_policies text[];
  forbidden_delete_tables text[];
  actual_policy_count integer;
  constraint_definition text;
begin
  select lower(pg_get_functiondef('public.is_manager()'::regprocedure))
  into function_definition;
  if function_definition not like '%and active%' then
    raise exception 'POSTFLIGHT: is_manager() does not require an active profile';
  end if;

  select lower(pg_get_functiondef('public.is_technician_or_manager()'::regprocedure))
  into function_definition;
  if function_definition not like '%and active%' then
    raise exception 'POSTFLIGHT: is_technician_or_manager() does not require an active profile';
  end if;

  if to_regprocedure('public.has_active_profile()') is null
     or to_regprocedure('public.is_active_technician()') is null
     or to_regprocedure('public.enforce_maintenance_status_transition()') is null then
    raise exception 'POSTFLIGHT: a security-hardening function is missing';
  end if;

  if has_function_privilege('anon', 'public.has_active_profile()', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_manager()', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_technician_or_manager()', 'EXECUTE')
     or has_function_privilege('anon', 'public.search_equipment_directory(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.search_equipment_inventory(text,text,public.risk_level)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_assigned_maintenance_status(bigint,text)', 'EXECUTE') then
    raise exception 'POSTFLIGHT: anon retains EXECUTE on a protected function';
  end if;

  if not has_function_privilege('authenticated', 'public.has_active_profile()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.search_equipment_directory(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_assigned_maintenance_status(bigint,text)', 'EXECUTE') then
    raise exception 'POSTFLIGHT: authenticated lost a required function privilege';
  end if;

  select array_agg(table_name order by table_name)
  into forbidden_delete_tables
  from unnest(array[
    'hospital_areas', 'equipment_types', 'manufacturers', 'equipment_models',
    'equipment_locations', 'equipment_assets', 'equipment_documents',
    'equipment_document_links', 'maintenance_programs',
    'equipment_maintenance_programs', 'risk_assessments',
    'inventory_import_batches', 'inventory_import_issues',
    'maintenance_records', 'maintenance_evidence'
  ]) as checked(table_name)
  where has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE');
  if forbidden_delete_tables is not null then
    raise exception 'POSTFLIGHT: authenticated retains DELETE on %', forbidden_delete_tables;
  end if;

  select array_agg(format('%I.%I', tablename, policyname) order by tablename, policyname)
  into unsafe_policies
  from pg_policies
  where schemaname = 'public'
    and 'authenticated' = any(roles)
    and permissive = 'PERMISSIVE'
    and (
      (cmd in ('SELECT', 'UPDATE', 'DELETE', 'ALL')
        and regexp_replace(coalesce(qual, ''), '[[:space:]()]', '', 'g') = 'true')
      or (cmd in ('INSERT', 'UPDATE', 'ALL')
        and regexp_replace(coalesce(with_check, qual, ''), '[[:space:]()]', '', 'g') = 'true')
    );
  if unsafe_policies is not null then
    raise exception 'POSTFLIGHT: permissive policies bypass role/profile checks: %', unsafe_policies;
  end if;

  select count(*) into actual_policy_count
  from pg_policies where schemaname = 'public';
  if actual_policy_count < 70 then
    raise exception 'POSTFLIGHT: expected at least the 70 hardened policies, found %', actual_policy_count;
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.maintenances'::regclass
      and t.tgname = 'enforce_maintenance_status_transition'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    raise exception 'POSTFLIGHT: maintenance transition trigger is missing or disabled';
  end if;

  select pg_get_constraintdef(oid, true)
  into constraint_definition
  from pg_constraint
  where conrelid = 'public.maintenance_records'::regclass
    and conname = 'maintenance_records_completed_after_start_check'
    and convalidated;
  if constraint_definition is null
     or lower(constraint_definition) not like '%started_at is not null%'
     or lower(constraint_definition) not like '%completed_at >= started_at%' then
    raise exception 'POSTFLIGHT: validated maintenance date constraint is missing or incomplete';
  end if;

  if (select count(*) from public.equipment_assets) <> 100
     or (select count(*) from public.risk_assessments) <> 100
     or (select count(*) from public.maintenance_programs) <> 44
     or (select count(*) from public.equipment_maintenance_programs) <> 100
     or (select count(*) from public.equipment_document_links) <> 199
     or (select count(*) from public.inventory_import_issues) <> 162 then
    raise exception 'POSTFLIGHT: an inventory count changed unexpectedly';
  end if;
end $$;

select jsonb_build_object(
  'result', 'SECURITY_HARDENING_POSTFLIGHT_COMPLETE',
  'assets', (select count(*) from public.equipment_assets),
  'risks', (select count(*) from public.risk_assessments),
  'programs', (select count(*) from public.maintenance_programs),
  'asset_program_links', (select count(*) from public.equipment_maintenance_programs),
  'document_links', (select count(*) from public.equipment_document_links),
  'review_issues', (select count(*) from public.inventory_import_issues),
  'policies', (select count(*) from pg_policies where schemaname = 'public'),
  'transition_trigger_enabled', exists (
    select 1 from pg_trigger
    where tgrelid = 'public.maintenances'::regclass
      and tgname = 'enforce_maintenance_status_transition' and tgenabled <> 'D'
  ),
  'started_at_nullable', (
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'maintenance_records'
      and column_name = 'started_at'
  )
) as security_hardening_postflight;

rollback;
