\set ON_ERROR_STOP on

-- Read-only gate for migration 15. Expected state: migration 14 installed.
begin transaction read only;

do $$
begin
  if to_regprocedure('public.has_active_profile()') is null
     or to_regprocedure('public.enforce_maintenance_status_transition()') is null
     or to_regprocedure('public.write_inventory_audit_log()') is null then
    raise exception 'PREFLIGHT 15: migration 14 dependencies are incomplete';
  end if;

  if to_regclass('public.reports') is null
     or to_regclass('public.maintenances') is null
     or to_regclass('public.maintenance_records') is null
     or to_regclass('public.maintenance_activities') is null
     or to_regclass('public.maintenance_evidence') is null then
    raise exception 'PREFLIGHT 15: required operational tables are missing';
  end if;

  if to_regprocedure('public.create_corrective_order_from_report(bigint,uuid,text,timestamp with time zone)') is not null
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'maintenances'
         and column_name = 'source_report_id'
     ) then
    raise exception 'PREFLIGHT 15: migration 15 appears already or partially installed';
  end if;

  if (select count(*) from public.equipment_assets) <> 100
     or (select count(*) from public.risk_assessments) <> 100
     or (select count(*) from public.maintenance_programs) <> 44
     or (select count(*) from public.equipment_document_links) <> 199
     or (select count(*) from public.inventory_import_issues) <> 162 then
    raise exception 'PREFLIGHT 15: known inventory counts do not match';
  end if;
end $$;

select 'MIGRATION_15_PREFLIGHT_OK' as result;
rollback;
