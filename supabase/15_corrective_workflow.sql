-- Transactional corrective-maintenance workflow.
-- Apply only after 14_security_hardening.sql.

begin;

alter table public.maintenances
  add column if not exists source_report_id bigint references public.reports(id),
  add column if not exists validated_by uuid references public.profiles(id),
  add column if not exists validated_at timestamptz,
  add column if not exists closure_notes text;

alter table public.maintenance_records
  add column if not exists technical_notes text;

create unique index if not exists maintenances_one_active_corrective_per_report_idx
  on public.maintenances(source_report_id)
  where source_report_id is not null and status in ('programado', 'en_proceso');

create index if not exists maintenances_source_report_idx
  on public.maintenances(source_report_id);

drop trigger if exists audit_reports on public.reports;
create trigger audit_reports
after insert or update on public.reports
for each row execute function public.write_inventory_audit_log();

drop trigger if exists audit_maintenance_records on public.maintenance_records;
create trigger audit_maintenance_records
after insert or update on public.maintenance_records
for each row execute function public.write_inventory_audit_log();

drop trigger if exists audit_maintenance_activities on public.maintenance_activities;
create trigger audit_maintenance_activities
after insert or update on public.maintenance_activities
for each row execute function public.write_inventory_audit_log();

drop trigger if exists audit_maintenance_evidence on public.maintenance_evidence;
create trigger audit_maintenance_evidence
after insert on public.maintenance_evidence
for each row execute function public.write_inventory_audit_log();

create or replace function public.create_corrective_order_from_report(
  target_report_id bigint,
  target_assigned_to uuid,
  target_priority text,
  target_scheduled_at timestamptz
)
returns public.maintenances
language plpgsql
security definer
set search_path = public
as $$
declare
  report_row public.reports;
  equipment_code text;
  normalized_priority text;
  report_priority text;
  created_row public.maintenances;
begin
  if not public.is_manager() then
    raise exception 'Operación reservada para el rol jefe';
  end if;

  normalized_priority := lower(nullif(btrim(target_priority), ''));
  if normalized_priority not in ('critica', 'alta', 'ordinaria') then
    raise exception 'Prioridad no válida';
  end if;
  report_priority := case normalized_priority
    when 'critica' then 'Crítica'
    when 'alta' then 'Alta'
    else 'Ordinaria'
  end;
  if target_scheduled_at is null then
    raise exception 'La fecha de atención es obligatoria';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = target_assigned_to and role = 'tecnico' and active
  ) then
    raise exception 'La persona asignada debe ser un técnico activo';
  end if;

  select r.* into report_row
  from public.reports r
  where r.id = target_report_id
  for update;
  if report_row.id is null then
    raise exception 'Reporte no encontrado';
  end if;
  if report_row.status in ('Resuelto', 'Cerrado') then
    raise exception 'El reporte ya fue finalizado';
  end if;
  if report_row.equipment_id is null then
    raise exception 'El reporte no está vinculado a un equipo registrado';
  end if;
  if report_row.maintenance_id is not null then
    raise exception 'El reporte ya tiene una orden vinculada';
  end if;
  if exists (
    select 1 from public.maintenances
    where source_report_id = target_report_id
      and status in ('programado', 'en_proceso')
  ) then
    raise exception 'El reporte ya tiene una orden correctiva activa';
  end if;

  select inventory_code into equipment_code
  from public.equipment_assets
  where id = report_row.equipment_id and active;
  if equipment_code is null then
    raise exception 'El equipo vinculado no existe o está inactivo';
  end if;

  insert into public.maintenances (
    maintenance_number, maintenance_code, equipment_identifier, equipment_id,
    source_report_id, status, scheduled_at, assigned_to, created_by, priority
  ) values (
    '', 'MC', equipment_code, report_row.equipment_id,
    report_row.id, 'programado', target_scheduled_at,
    target_assigned_to, auth.uid(), normalized_priority
  ) returning * into created_row;

  update public.reports
  set priority = report_priority,
      status = 'Asignado',
      maintenance_id = created_row.id
  where id = report_row.id;

  return created_row;
end;
$$;

create or replace function public.save_corrective_intervention(
  target_maintenance_id bigint,
  new_started_at timestamptz,
  new_completed_at timestamptz,
  new_diagnosis text,
  new_work_performed text,
  new_test_results text,
  new_equipment_condition text,
  new_technical_notes text default null
)
returns public.maintenance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  maintenance_row public.maintenances;
  saved_row public.maintenance_records;
begin
  if not public.is_active_technician() then
    raise exception 'Operación reservada para un técnico activo';
  end if;
  select * into maintenance_row
  from public.maintenances
  where id = target_maintenance_id
  for update;
  if maintenance_row.id is null
     or maintenance_row.maintenance_code <> 'MC'
     or maintenance_row.assigned_to <> auth.uid() then
    raise exception 'Orden correctiva no encontrada o no asignada al técnico';
  end if;
  if maintenance_row.status <> 'en_proceso' then
    raise exception 'La orden debe estar en proceso para registrar la intervención';
  end if;
  if new_started_at is null then
    raise exception 'La fecha de inicio es obligatoria';
  end if;
  if new_started_at > now() then
    raise exception 'La fecha de inicio no puede estar en el futuro';
  end if;
  if new_completed_at is not null and new_completed_at > now() then
    raise exception 'La fecha de finalización no puede estar en el futuro';
  end if;
  if new_equipment_condition is not null
     and new_equipment_condition not in ('operativo', 'en_reparacion', 'fuera_de_servicio') then
    raise exception 'Condición final no válida';
  end if;
  if new_completed_at is not null and (
    nullif(btrim(new_diagnosis), '') is null
    or nullif(btrim(new_work_performed), '') is null
    or nullif(btrim(new_test_results), '') is null
    or new_equipment_condition is null
  ) then
    raise exception 'El expediente debe estar completo para finalizar la intervención';
  end if;

  insert into public.maintenance_records (
    maintenance_id, performed_by, started_at, completed_at,
    diagnosis, work_performed, test_results, equipment_condition, technical_notes
  ) values (
    maintenance_row.id, auth.uid(), new_started_at, new_completed_at,
    nullif(btrim(new_diagnosis), ''), nullif(btrim(new_work_performed), ''),
    nullif(btrim(new_test_results), ''), new_equipment_condition,
    nullif(btrim(new_technical_notes), '')
  )
  on conflict (maintenance_id) do update
  set performed_by = excluded.performed_by,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      diagnosis = excluded.diagnosis,
      work_performed = excluded.work_performed,
      test_results = excluded.test_results,
      equipment_condition = excluded.equipment_condition,
      technical_notes = excluded.technical_notes
  returning * into saved_row;

  if new_completed_at is not null and maintenance_row.source_report_id is not null then
    update public.reports
    set status = 'Resuelto'
    where id = maintenance_row.source_report_id;
  end if;
  return saved_row;
end;
$$;

create or replace function public.update_assigned_maintenance_status(
  target_maintenance_id bigint,
  new_status text
)
returns public.maintenances
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.maintenances;
  updated_row public.maintenances;
begin
  if new_status not in ('programado', 'en_proceso', 'cancelado') then
    if new_status = 'completado' then
      raise exception 'El cierre requiere validación del jefe';
    end if;
    raise exception 'Estado de mantenimiento no válido';
  end if;

  select * into current_row
  from public.maintenances
  where id = target_maintenance_id
  for update;
  if current_row.id is null then
    raise exception 'Orden no encontrada';
  end if;

  if public.is_active_technician() and current_row.assigned_to = auth.uid() then
    if new_status <> 'en_proceso' then
      raise exception 'El técnico únicamente puede iniciar su orden asignada';
    end if;
  elsif public.is_manager() then
    if new_status not in ('en_proceso', 'cancelado') then
      raise exception 'Transición administrativa no autorizada';
    end if;
  else
    raise exception 'Orden no autorizada para la sesión';
  end if;

  update public.maintenances
  set status = new_status
  where id = current_row.id
  returning * into updated_row;

  if current_row.source_report_id is not null then
    if new_status = 'en_proceso' then
      update public.reports set status = 'En atención'
      where id = current_row.source_report_id;
    elsif new_status = 'cancelado' then
      update public.reports
      set status = 'Clasificado', maintenance_id = null
      where id = current_row.source_report_id;
    end if;
  end if;
  return updated_row;
end;
$$;

create or replace function public.validate_corrective_closure(
  target_maintenance_id bigint,
  validation_notes text default null
)
returns public.maintenances
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.maintenances;
  updated_row public.maintenances;
begin
  if not public.is_manager() then
    raise exception 'Operación reservada para el rol jefe';
  end if;
  select * into current_row
  from public.maintenances
  where id = target_maintenance_id
  for update;
  if current_row.id is null or current_row.maintenance_code <> 'MC' then
    raise exception 'Orden correctiva no encontrada';
  end if;
  if current_row.status <> 'en_proceso' then
    raise exception 'La orden debe estar en proceso para validar el cierre';
  end if;
  if current_row.source_report_id is null then
    raise exception 'La orden no conserva su reporte de origen';
  end if;

  update public.maintenances
  set status = 'completado',
      validated_by = auth.uid(),
      validated_at = now(),
      closure_notes = nullif(btrim(validation_notes), '')
  where id = current_row.id
  returning * into updated_row;

  update public.reports
  set status = 'Cerrado', maintenance_id = updated_row.id
  where id = current_row.source_report_id;
  return updated_row;
end;
$$;

revoke update on public.reports from authenticated, anon;
revoke insert, update on public.maintenances from authenticated, anon;
revoke insert, update on public.maintenance_records from authenticated, anon;
grant select on public.reports, public.maintenances, public.maintenance_records,
  public.maintenance_activities, public.maintenance_evidence to authenticated;
grant insert on public.reports to authenticated;
grant usage, select on sequence public.reports_id_seq to authenticated;

revoke all on function public.create_corrective_order_from_report(bigint, uuid, text, timestamptz) from public, anon;
grant execute on function public.create_corrective_order_from_report(bigint, uuid, text, timestamptz) to authenticated;
revoke all on function public.save_corrective_intervention(bigint, timestamptz, timestamptz, text, text, text, text, text) from public, anon;
grant execute on function public.save_corrective_intervention(bigint, timestamptz, timestamptz, text, text, text, text, text) to authenticated;
revoke all on function public.update_assigned_maintenance_status(bigint, text) from public, anon;
grant execute on function public.update_assigned_maintenance_status(bigint, text) to authenticated;
revoke all on function public.validate_corrective_closure(bigint, text) from public, anon;
grant execute on function public.validate_corrective_closure(bigint, text) to authenticated;

commit;
