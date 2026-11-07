-- Single read-only postflight for migration 17.
do $$
begin
  if to_regclass('public.quote_items') is null then raise exception 'quote_items is missing'; end if;
  if to_regprocedure('public.set_training_participants(bigint,uuid[])') is null
     or to_regprocedure('public.list_active_profile_directory()') is null
     or to_regprocedure('public.update_training_participant_attendance(bigint,uuid,text)') is null
     or to_regprocedure('public.update_training_status(bigint,text)') is null
     or (to_regprocedure('public.save_quote_items(bigint,text,jsonb)') is null
       and to_regprocedure('public.save_quote_items(bigint,text,jsonb,uuid,bigint)') is null) then
    raise exception 'Migration 17 RPCs are incomplete';
  end if;
  if coalesce(has_function_privilege('anon', to_regprocedure('public.save_quote_items(bigint,text,jsonb)'), 'EXECUTE'), false)
     or coalesce(has_function_privilege('anon', to_regprocedure('public.save_quote_items(bigint,text,jsonb,uuid,bigint)'), 'EXECUTE'), false)
     or has_function_privilege('anon', 'public.set_training_participants(bigint,uuid[])', 'EXECUTE') then
    raise exception 'Anonymous execution privilege detected';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quote_items' and policyname='active managers read quote items') then
    raise exception 'Quote item RLS is incomplete';
  end if;
end $$;
select json_build_object(
  'result', 'BUSINESS_COMPLETION_POSTFLIGHT_COMPLETE',
  'assets', (select count(*) from public.equipment_assets),
  'trainings', (select count(*) from public.trainings),
  'training_participants', (select count(*) from public.training_participants),
  'quotes', (select count(*) from public.quotes),
  'quote_items', (select count(*) from public.quote_items)
);
