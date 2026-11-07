-- Destructive only inside the disposable local database.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

insert into public.trainings(title, purpose, recurrence, scheduled_at, instructor_id, description)
values ('Capacitación sintética', 'protocolo', 'unica', now() + interval '1 day', auth.uid(), 'Prueba local')
returning training_number;

select * from public.set_training_participants(
  (select id from public.trainings where title = 'Capacitación sintética' order by id desc limit 1),
  array['00000000-0000-0000-0000-000000000003'::uuid]
);
select (public.update_training_participant_attendance(
  (select id from public.trainings where title = 'Capacitación sintética' order by id desc limit 1),
  '00000000-0000-0000-0000-000000000003', 'asistio'
)).attendance_status;
select (public.update_training_status((select id from public.trainings where title = 'Capacitación sintética' order by id desc limit 1), 'en_curso')).status;
select (public.update_training_status((select id from public.trainings where title = 'Capacitación sintética' order by id desc limit 1), 'completada')).status;

insert into public.quotes(supplier, equipment_description, amount, notes)
values ('Proveedor sintético', 'Equipo sintético', 0, 'Prueba local') returning quote_number;
select (public.save_quote_items(
  (select id from public.quotes where supplier = 'Proveedor sintético' order by id desc limit 1),
  'en_revision',
  '[{"description":"Concepto A","quantity":2,"unit_cost":125.50},{"description":"Concepto B","quantity":1,"unit_cost":50}]'::jsonb
)).amount;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$
declare blocked_training boolean := false; blocked_quote boolean := false;
begin
  begin perform public.update_training_status((select id from public.trainings order by id desc limit 1), 'cancelada'); exception when others then blocked_training := true; end;
  begin perform public.save_quote_items((select id from public.quotes order by id desc limit 1), 'aprobada', '[{"description":"No autorizado","quantity":1,"unit_cost":1}]'); exception when others then blocked_quote := true; end;
  if not blocked_training or not blocked_quote then raise exception 'A normal user executed privileged business functions'; end if;
  if (select count(*) from public.quote_items) <> 0 then raise exception 'A normal user can read quote concepts'; end if;
end $$;
reset role;

do $$
begin
  if (select amount from public.quotes where supplier = 'Proveedor sintético' order by id desc limit 1) <> 301.00 then raise exception 'Quote total was not calculated transactionally'; end if;
  if not exists (select 1 from public.training_participants where attendance_status = 'asistio') then raise exception 'Attendance did not persist'; end if;
  if (select count(*) from public.equipment_assets) <> 100 then raise exception 'Inventory was modified'; end if;
end $$;

select 'TRAINING_QUOTES_COMPLETION_VALIDATION_COMPLETE' as result;
