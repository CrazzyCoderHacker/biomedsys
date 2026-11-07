\set ON_ERROR_STOP on

-- Read-only gate for migration 17. Expected state: migration 16 installed.
begin transaction read only;

do $$
begin
  if to_regclass('public.file_attachments') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.profile_change_history') is null
     or to_regclass('public.institution_settings') is null
     or to_regprocedure('public.validate_preventive_closure(bigint,text)') is null
     or to_regprocedure('public.manage_profile(uuid,text,text,public.app_role,boolean,text)') is null then
    raise exception 'PREFLIGHT 17: migration 16 dependencies are incomplete';
  end if;

  if to_regclass('public.quote_items') is not null
     or to_regprocedure('public.set_training_participants(bigint,uuid[])') is not null
     or to_regprocedure('public.save_quote_items(bigint,text,jsonb)') is not null then
    raise exception 'PREFLIGHT 17: migration 17 appears already or partially installed';
  end if;

  if (select count(*) from public.equipment_assets) <> 100
     or (select count(*) from public.risk_assessments) <> 100
     or (select count(*) from public.maintenance_programs) <> 44
     or (select count(*) from public.equipment_document_links) <> 199
     or (select count(*) from public.inventory_import_issues) <> 162 then
    raise exception 'PREFLIGHT 17: known inventory counts do not match';
  end if;
end $$;

select 'MIGRATION_17_PREFLIGHT_OK' as result;
rollback;
