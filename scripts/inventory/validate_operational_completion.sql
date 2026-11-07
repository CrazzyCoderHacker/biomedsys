-- Disposable validation for migration 16. Never run against production.

-- Self-service profile editing cannot change role or active state.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
select (public.update_own_profile('Usuario Clínico Validado', 'Área Clínica Validada')).id;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.manage_profile(
      '00000000-0000-0000-0000-000000000003', 'Escalamiento', null, 'jefe', true, 'Intento inválido'
    );
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Ordinary user managed a profile'; end if;
end $$;
reset role;

-- Manager changes a technician and the durable history records it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select (public.manage_profile(
  '00000000-0000-0000-0000-000000000002', 'Técnico Activo', 'Ingeniería Clínica',
  'tecnico', true, 'Validación de administración local'
)).id;
select (public.update_institution_settings(
  'Hospital de Validación Local', 'America/Mexico_City', 'MXN', 30::smallint
)).id;
reset role;

-- Configure one validated periodicity locally, schedule exactly one active order.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select (public.configure_equipment_preventive_program(
  (select equipment_id from public.equipment_maintenance_programs order by equipment_id limit 1),
  (select maintenance_program_id from public.equipment_maintenance_programs order by equipment_id limit 1),
  6::smallint, 'Periodicidad exclusiva de la prueba local', 'No procede de Final.xlsx', current_date, null::date
)).maintenance_program_id;
select (public.schedule_preventive_maintenance(
  (select equipment_id from public.equipment_maintenance_programs order by equipment_id limit 1),
  (select maintenance_program_id from public.equipment_maintenance_programs order by equipment_id limit 1),
  now() + interval '1 minute', '00000000-0000-0000-0000-000000000002', 'ordinaria'
)).maintenance_number;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.schedule_preventive_maintenance(
      (select equipment_id from public.equipment_maintenance_programs order by equipment_id limit 1),
      (select maintenance_program_id from public.equipment_maintenance_programs order by equipment_id limit 1),
      now() + interval '2 minutes', '00000000-0000-0000-0000-000000000002', 'ordinaria'
    );
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Duplicate active preventive order was accepted'; end if;
end $$;
reset role;

-- Use a past scheduled date only inside the disposable test so the order can close now.
update public.maintenances set scheduled_at = now() - interval '1 hour'
where maintenance_code = 'MP' and status = 'programado';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select (public.update_assigned_maintenance_status(
  (select id from public.maintenances where maintenance_code = 'MP' and status = 'programado' order by id desc limit 1),
  'en_proceso'
)).maintenance_number;
do $$
declare blocked boolean := false; target_id bigint;
begin
  select id into target_id from public.maintenances where maintenance_code = 'MP' and status = 'en_proceso' order by id desc limit 1;
  begin
    perform public.save_preventive_intervention(
      target_id, now() - interval '30 minutes', now(), 'Diagnóstico', 'Trabajo', 'Pruebas',
      'operativo', null, '[{"activity":"Inspección","completed":false}]'::jsonb
    );
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Incomplete preventive activities were accepted'; end if;
end $$;
select (public.save_preventive_intervention(
  (select id from public.maintenances where maintenance_code = 'MP' and status = 'en_proceso' order by id desc limit 1),
  now() - interval '30 minutes', now(), 'Inspección preventiva', 'Rutina ejecutada',
  'Pruebas satisfactorias', 'operativo', 'Validación local',
  '[{"activity":"Inspección visual","completed":true,"notes":"Sin hallazgos"}]'::jsonb
)).id;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select (public.validate_preventive_closure(
  (select id from public.maintenances where maintenance_code = 'MP' and status = 'en_proceso' order by id desc limit 1),
  'Cierre preventivo validado localmente'
)).maintenance_number;
reset role;

-- File metadata follows the parent report and never contains file bytes.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
insert into public.file_attachments (
  storage_path, original_name, mime_type, size_bytes, report_id, description
) values (
  auth.uid()::text || '/reports/validation.pdf', 'validation.pdf', 'application/pdf', 128,
  (select id from public.reports where reporter_id = auth.uid() order by id limit 1), 'Metadato local'
);
do $$
begin
  if (select count(*) from public.file_attachments) <> 1 then raise exception 'Attachment metadata was not persisted'; end if;
end $$;
reset role;

-- An unrelated technician cannot read that report attachment.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
do $$ begin
  if (select count(*) from public.file_attachments) <> 0 then raise exception 'Unrelated technician read a report attachment'; end if;
end $$;
reset role;

-- Recipients can read and mark only their own notifications.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$
declare notification_id bigint;
begin
  select id into notification_id from public.notifications where recipient_id = auth.uid() order by id desc limit 1;
  if notification_id is null then raise exception 'Assigned technician did not receive a notification'; end if;
  perform public.mark_notification_read(notification_id, true);
  if not exists (select 1 from public.notifications where id = notification_id and read_at is not null) then
    raise exception 'Notification was not marked read';
  end if;
end $$;
reset role;

do $$
begin
  if (select count(*) from public.equipment_assets) <> 100 then raise exception 'Inventory assets changed'; end if;
  if (select count(*) from public.risk_assessments) <> 100 then raise exception 'Risk assessments changed'; end if;
  if (select count(*) from public.profile_change_history) < 1 then raise exception 'Profile history missing'; end if;
  if not exists (select 1 from public.maintenances where maintenance_code = 'MP' and status = 'completado') then
    raise exception 'Preventive order did not close';
  end if;
  if not exists (select 1 from public.equipment_maintenance_programs where last_completed_on is not null and next_due_on is not null) then
    raise exception 'Validated periodicity did not advance';
  end if;
end $$;

select 'OPERATIONAL_COMPLETION_VALIDATION_COMPLETE' as result;
