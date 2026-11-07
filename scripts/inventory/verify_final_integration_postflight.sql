-- Read-only postflight after migration 18.
do $$
begin
  if to_regclass('public.quote_status_history') is null then raise exception 'quote_status_history is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='must_change_password') then raise exception 'profiles.must_change_password is missing'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='file_attachments' and column_name='deleted_at') then raise exception 'Attachment lifecycle columns are missing'; end if;
  if to_regprocedure('public.deactivate_attachment(uuid)') is null
     or to_regprocedure('public.complete_password_change()') is null
     or to_regprocedure('public.save_quote_items(bigint,text,jsonb,uuid,bigint)') is null
     or to_regprocedure('public.get_profile_activity(uuid)') is null
     or to_regprocedure('public.get_equipment_activity(uuid)') is null then
    raise exception 'Migration 18 functions are incomplete';
  end if;
  if has_table_privilege('authenticated', 'public.file_attachments', 'DELETE') then raise exception 'Direct attachment deletion is still granted'; end if;
end $$;
select json_build_object(
  'result', 'FINAL_INTEGRATION_POSTFLIGHT_COMPLETE',
  'assets', (select count(*) from public.equipment_assets),
  'risks', (select count(*) from public.risk_assessments),
  'programs', (select count(*) from public.maintenance_programs),
  'document_links', (select count(*) from public.equipment_document_links),
  'issues', (select count(*) from public.inventory_import_issues),
  'tables', (select count(*) from pg_tables where schemaname='public'),
  'policies', (select count(*) from pg_policies where schemaname='public')
);
