\set ON_ERROR_STOP on

-- Read-only gate for migration 16. Expected state: migration 15 installed.
begin transaction read only;

do $$
begin
  if to_regprocedure('public.create_corrective_order_from_report(bigint,uuid,text,timestamp with time zone)') is null
     or to_regprocedure('public.save_corrective_intervention(bigint,timestamp with time zone,timestamp with time zone,text,text,text,text,text)') is null
     or to_regprocedure('public.validate_corrective_closure(bigint,text)') is null then
    raise exception 'PREFLIGHT 16: migration 15 dependencies are incomplete';
  end if;

  if to_regclass('public.file_attachments') is not null
     or to_regclass('public.notifications') is not null
     or to_regclass('public.profile_change_history') is not null
     or to_regclass('public.institution_settings') is not null
     or to_regprocedure('public.validate_preventive_closure(bigint,text)') is not null then
    raise exception 'PREFLIGHT 16: migration 16 appears already or partially installed';
  end if;

  if (select count(*) from public.equipment_assets) <> 100
     or (select count(*) from public.risk_assessments) <> 100
     or (select count(*) from public.maintenance_programs) <> 44
     or (select count(*) from public.equipment_document_links) <> 199
     or (select count(*) from public.inventory_import_issues) <> 162 then
    raise exception 'PREFLIGHT 16: known inventory counts do not match';
  end if;
end $$;

select 'MIGRATION_16_PREFLIGHT_OK' as result;
rollback;
