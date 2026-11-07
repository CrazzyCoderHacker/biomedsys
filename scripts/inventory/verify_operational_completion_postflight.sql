-- Read-only postflight for migration 16.
do $$
begin
  if to_regclass('public.file_attachments') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.profile_change_history') is null
     or to_regclass('public.institution_settings') is null then
    raise exception 'Migration 16 tables are incomplete';
  end if;
  if to_regprocedure('public.save_preventive_intervention(bigint,timestamp with time zone,timestamp with time zone,text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.validate_preventive_closure(bigint,text)') is null
     or to_regprocedure('public.refresh_my_preventive_notifications()') is null
     or to_regprocedure('public.manage_profile(uuid,text,text,public.app_role,boolean,text)') is null then
    raise exception 'Migration 16 RPCs are incomplete';
  end if;
  if has_function_privilege('anon', 'public.manage_profile(uuid,text,text,public.app_role,boolean,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_preventive_intervention(bigint,timestamp with time zone,timestamp with time zone,text,text,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'Anonymous role retained privileged RPC execution';
  end if;
  if (select count(*) from public.equipment_assets) <> 100
     or (select count(*) from public.risk_assessments) <> 100 then
    raise exception 'Inventory counts changed after migration 16';
  end if;
end $$;

select json_build_object(
  'result', 'OPERATIONAL_COMPLETION_POSTFLIGHT_COMPLETE',
  'assets', (select count(*) from public.equipment_assets),
  'risks', (select count(*) from public.risk_assessments),
  'notifications', (select count(*) from public.notifications),
  'attachments', (select count(*) from public.file_attachments),
  'profile_changes', (select count(*) from public.profile_change_history),
  'policies', (select count(*) from pg_policies where schemaname = 'public')
);
