\set ON_ERROR_STOP on

-- Read-only gate immediately before migration 18. Expected state: migration 17 installed.
begin transaction read only;

do $$
begin
  if to_regprocedure('public.validate_corrective_closure(bigint,text)') is null then raise exception 'Migration 15 is missing'; end if;
  if to_regprocedure('public.validate_preventive_closure(bigint,text)') is null then raise exception 'Migration 16 is missing'; end if;
  if to_regclass('public.quote_items') is null or to_regprocedure('public.save_quote_items(bigint,text,jsonb)') is null then raise exception 'Migration 17 is missing'; end if;
  if to_regclass('public.quote_status_history') is not null
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name = 'must_change_password'
     )
     or to_regprocedure('public.deactivate_attachment(uuid)') is not null then
    raise exception 'PREFLIGHT 18: migration 18 appears already or partially installed';
  end if;
  if (select count(*) from public.equipment_assets) <> 100
     or (select count(*) from public.risk_assessments) <> 100
     or (select count(*) from public.maintenance_programs) <> 44
     or (select count(*) from public.equipment_document_links) <> 199
     or (select count(*) from public.inventory_import_issues) <> 162 then
    raise exception 'PREFLIGHT 18: known inventory counts do not match';
  end if;
end $$;
select 'MIGRATION_18_PREFLIGHT_OK' as result;
rollback;
