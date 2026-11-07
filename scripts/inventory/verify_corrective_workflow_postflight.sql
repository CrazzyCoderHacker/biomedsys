\set ON_ERROR_STOP on

begin transaction read only;

do $$
begin
  if to_regprocedure('public.create_corrective_order_from_report(bigint,uuid,text,timestamp with time zone)') is null
     or to_regprocedure('public.save_corrective_intervention(bigint,timestamp with time zone,timestamp with time zone,text,text,text,text,text)') is null
     or to_regprocedure('public.validate_corrective_closure(bigint,text)') is null then
    raise exception 'POSTFLIGHT 15: required workflow RPC is missing';
  end if;
  if has_function_privilege('anon', 'public.create_corrective_order_from_report(bigint,uuid,text,timestamp with time zone)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_corrective_intervention(bigint,timestamp with time zone,timestamp with time zone,text,text,text,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.validate_corrective_closure(bigint,text)', 'EXECUTE') then
    raise exception 'POSTFLIGHT 15: anon can execute a corrective workflow RPC';
  end if;
  if has_table_privilege('authenticated', 'public.reports', 'UPDATE')
     or has_table_privilege('authenticated', 'public.maintenances', 'INSERT')
     or has_table_privilege('authenticated', 'public.maintenances', 'UPDATE')
     or has_table_privilege('authenticated', 'public.maintenance_records', 'INSERT')
     or has_table_privilege('authenticated', 'public.maintenance_records', 'UPDATE') then
    raise exception 'POSTFLIGHT 15: direct transactional-table writes remain granted';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'maintenances_one_active_corrective_per_report_idx'
  ) then raise exception 'POSTFLIGHT 15: duplicate-order index is missing'; end if;
  if (
    select count(*) from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
      and t.tgname in ('audit_reports', 'audit_maintenance_records', 'audit_maintenance_activities', 'audit_maintenance_evidence')
      and t.tgenabled <> 'D'
  ) <> 4 then raise exception 'POSTFLIGHT 15: workflow audit triggers are incomplete'; end if;
  if (select count(*) from public.equipment_assets) <> 100
     or (select count(*) from public.risk_assessments) <> 100
     or (select count(*) from public.maintenance_programs) <> 44
     or (select count(*) from public.equipment_document_links) <> 199
     or (select count(*) from public.inventory_import_issues) <> 162 then
    raise exception 'POSTFLIGHT 15: inventory counts changed unexpectedly';
  end if;
end $$;

select jsonb_build_object(
  'result', 'CORRECTIVE_WORKFLOW_POSTFLIGHT_COMPLETE',
  'reports', (select count(*) from public.reports),
  'maintenances', (select count(*) from public.maintenances),
  'technical_records', (select count(*) from public.maintenance_records),
  'assets', (select count(*) from public.equipment_assets),
  'risks', (select count(*) from public.risk_assessments),
  'programs', (select count(*) from public.maintenance_programs),
  'document_links', (select count(*) from public.equipment_document_links),
  'review_issues', (select count(*) from public.inventory_import_issues)
) as corrective_workflow_postflight;

rollback;
