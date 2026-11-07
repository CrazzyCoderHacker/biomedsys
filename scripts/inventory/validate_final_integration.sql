-- Functional validation for migration 18, disposable PostgreSQL only.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
do $$ declare blocked boolean := false;
begin
  begin perform public.deactivate_attachment((select id from public.file_attachments where deleted_at is null limit 1));
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Unrelated technician deactivated another user attachment'; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select (public.deactivate_attachment((select id from public.file_attachments where uploaded_by = auth.uid() and deleted_at is null limit 1))).id;
do $$ begin
  if (select count(*) from public.file_attachments) <> 0 then raise exception 'Deactivated attachment remains visible through RLS'; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select (public.save_quote_items(
  (select id from public.quotes where supplier = 'Proveedor sintético' order by id desc limit 1),
  'aprobada', '[{"description":"Concepto final","quantity":2,"unit_cost":150.50}]'::jsonb,
  (select id from public.equipment_assets order by inventory_code limit 1), null
)).quote_number;
do $$ declare blocked boolean := false;
begin
  begin perform public.save_quote_items(
    (select id from public.quotes where supplier = 'Proveedor sintético' order by id desc limit 1),
    'pendiente', '[{"description":"Reapertura","quantity":1,"unit_cost":1}]'::jsonb, null, null
  ); exception when others then blocked := true; end;
  if not blocked then raise exception 'Final quote was reopened'; end if;
  if not exists (select 1 from public.quote_status_history where previous_status = 'en_revision' and new_status = 'aprobada') then
    raise exception 'Quote status history missing';
  end if;
  if (select count(*) from public.get_equipment_activity((select equipment_id from public.quotes where supplier='Proveedor sintético' order by id desc limit 1))) < 1 then
    raise exception 'Equipment timeline is empty';
  end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$ begin
  if (select count(*) from public.get_profile_activity()) < 1 then raise exception 'Own profile timeline is empty'; end if;
end $$;
reset role;

do $$
begin
  if (select count(*) from public.equipment_assets) <> 100 then raise exception 'Inventory assets changed'; end if;
  if has_function_privilege('anon', 'public.deactivate_attachment(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_profile_activity(uuid)', 'EXECUTE') then
    raise exception 'Anonymous execution privilege detected';
  end if;
  if has_table_privilege('authenticated', 'public.file_attachments', 'DELETE') then
    raise exception 'Direct attachment DELETE remains granted';
  end if;
end $$;

select 'FINAL_INTEGRATION_VALIDATION_COMPLETE' as result;
