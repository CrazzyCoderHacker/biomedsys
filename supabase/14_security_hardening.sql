-- Incremental security and maintenance-state hardening.
-- Apply only after 13_inventory_administration.sql.

begin;

create or replace function public.has_active_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
  )
$$;

create or replace function public.is_active_technician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'tecnico' and active
  )
$$;

revoke all on function public.has_active_profile() from public, anon;
grant execute on function public.has_active_profile() to authenticated;
revoke all on function public.is_active_technician() from public, anon;
grant execute on function public.is_active_technician() to authenticated;
revoke all on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;
revoke all on function public.is_technician_or_manager() from public, anon;
grant execute on function public.is_technician_or_manager() to authenticated;

-- An inactive profile is not an application identity, even when Auth still has a session.
drop policy if exists "users read their profile" on public.profiles;
drop policy if exists "active users read their profile" on public.profiles;
create policy "active users read their profile" on public.profiles
for select to authenticated
using ((id = auth.uid() and active) or public.is_manager());

drop policy if exists "authenticated users read maintenance catalog" on public.maintenance_catalog;
drop policy if exists "active users read maintenance catalog" on public.maintenance_catalog;
create policy "active users read maintenance catalog" on public.maintenance_catalog
for select to authenticated using (public.has_active_profile());

drop policy if exists "authorized users read maintenances" on public.maintenances;
drop policy if exists "active authorized users read maintenances" on public.maintenances;
create policy "active authorized users read maintenances" on public.maintenances
for select to authenticated using (
  public.has_active_profile()
  and (created_by = auth.uid() or assigned_to = auth.uid() or public.is_manager())
);

drop policy if exists "authorized users read activities" on public.maintenance_activities;
drop policy if exists "active authorized users read activities" on public.maintenance_activities;
create policy "active authorized users read activities" on public.maintenance_activities
for select to authenticated using (
  public.has_active_profile()
  and exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id
      and (m.created_by = auth.uid() or m.assigned_to = auth.uid() or public.is_manager())
  )
);

drop policy if exists "authenticated users create reports" on public.reports;
drop policy if exists "active users create reports" on public.reports;
create policy "active users create reports" on public.reports
for insert to authenticated
with check (public.has_active_profile() and reporter_id = auth.uid());

drop policy if exists "users read own reports" on public.reports;
drop policy if exists "active users read authorized reports" on public.reports;
create policy "active users read authorized reports" on public.reports
for select to authenticated using (
  public.has_active_profile() and (reporter_id = auth.uid() or public.is_manager())
);

drop policy if exists "clinicians read trainings" on public.trainings;
drop policy if exists "active users read trainings" on public.trainings;
create policy "active users read trainings" on public.trainings
for select to authenticated using (public.has_active_profile());

drop policy if exists "engineers manage trainings" on public.trainings;
drop policy if exists "active engineers manage trainings" on public.trainings;
create policy "active engineers manage trainings" on public.trainings
for all to authenticated
using (public.is_active_technician() or public.is_manager())
with check (
  (public.is_active_technician() and instructor_id = auth.uid())
  or public.is_manager()
);

drop policy if exists "participants read training links" on public.training_participants;
drop policy if exists "active participants read training links" on public.training_participants;
create policy "active participants read training links" on public.training_participants
for select to authenticated using (
  public.has_active_profile() and (participant_id = auth.uid() or public.is_manager())
);

drop policy if exists "engineers manage training links" on public.training_participants;
drop policy if exists "active engineers manage training links" on public.training_participants;
create policy "active engineers manage training links" on public.training_participants
for all to authenticated
using (public.is_active_technician() or public.is_manager())
with check (public.is_active_technician() or public.is_manager());

drop policy if exists "assigned technicians read linked reports" on public.reports;
drop policy if exists "active assigned technicians read linked reports" on public.reports;
create policy "active assigned technicians read linked reports" on public.reports
for select to authenticated using (
  public.is_active_technician() and exists (
    select 1 from public.maintenances m
    where m.id = reports.maintenance_id and m.assigned_to = auth.uid()
  )
);

drop policy if exists "authorized users read maintenance records" on public.maintenance_records;
drop policy if exists "active authorized users read maintenance records" on public.maintenance_records;
create policy "active authorized users read maintenance records" on public.maintenance_records
for select to authenticated using (
  public.is_manager() or (
    public.is_active_technician() and exists (
      select 1 from public.maintenances m
      where m.id = maintenance_id and m.assigned_to = auth.uid()
    )
  )
);

drop policy if exists "assigned technicians create maintenance records" on public.maintenance_records;
drop policy if exists "active assigned technicians create maintenance records" on public.maintenance_records;
create policy "active assigned technicians create maintenance records" on public.maintenance_records
for insert to authenticated with check (
  public.is_active_technician()
  and performed_by = auth.uid()
  and exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
);

drop policy if exists "assigned technicians update maintenance records" on public.maintenance_records;
drop policy if exists "active assigned technicians update maintenance records" on public.maintenance_records;
create policy "active assigned technicians update maintenance records" on public.maintenance_records
for update to authenticated using (
  public.is_active_technician()
  and performed_by = auth.uid()
  and exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
) with check (
  public.is_active_technician()
  and performed_by = auth.uid()
  and exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
);

drop policy if exists "authorized users read maintenance evidence" on public.maintenance_evidence;
drop policy if exists "active authorized users read maintenance evidence" on public.maintenance_evidence;
create policy "active authorized users read maintenance evidence" on public.maintenance_evidence
for select to authenticated using (
  public.is_manager() or (
    public.is_active_technician() and exists (
      select 1 from public.maintenances m
      where m.id = maintenance_id and m.assigned_to = auth.uid()
    )
  )
);

drop policy if exists "assigned technicians create maintenance evidence" on public.maintenance_evidence;
drop policy if exists "active assigned technicians create maintenance evidence" on public.maintenance_evidence;
create policy "active assigned technicians create maintenance evidence" on public.maintenance_evidence
for insert to authenticated with check (
  public.is_manager() or (
    public.is_active_technician()
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.maintenances m
      where m.id = maintenance_id and m.assigned_to = auth.uid()
    )
  )
);

drop policy if exists "assigned technicians create activities" on public.maintenance_activities;
drop policy if exists "active assigned technicians create activities" on public.maintenance_activities;
create policy "active assigned technicians create activities" on public.maintenance_activities
for insert to authenticated with check (
  public.is_manager() or (
    public.is_active_technician() and exists (
      select 1 from public.maintenances m
      where m.id = maintenance_id and m.assigned_to = auth.uid()
    )
  )
);

drop policy if exists "assigned technicians update activities" on public.maintenance_activities;
drop policy if exists "active assigned technicians update activities" on public.maintenance_activities;
create policy "active assigned technicians update activities" on public.maintenance_activities
for update to authenticated using (
  public.is_manager() or (
    public.is_active_technician() and exists (
      select 1 from public.maintenances m
      where m.id = maintenance_id and m.assigned_to = auth.uid()
    )
  )
) with check (
  public.is_manager() or (
    public.is_active_technician() and exists (
      select 1 from public.maintenances m
      where m.id = maintenance_id and m.assigned_to = auth.uid()
    )
  )
);

-- Replace broad manager FOR ALL policies on durable records with explicit writes.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hospital_areas', 'equipment_types', 'manufacturers', 'equipment_models',
    'equipment_locations', 'equipment_assets', 'equipment_documents',
    'equipment_document_links', 'maintenance_programs',
    'equipment_maintenance_programs', 'risk_assessments'
  ] loop
    execute format('drop policy if exists "managers manage %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "managers insert %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "managers update %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "managers insert %1$s" on public.%1$I for insert to authenticated with check (public.is_manager())',
      table_name
    );
    execute format(
      'create policy "managers update %1$s" on public.%1$I for update to authenticated using (public.is_manager()) with check (public.is_manager())',
      table_name
    );
  end loop;
end $$;

drop policy if exists "managers manage import batches" on public.inventory_import_batches;
drop policy if exists "managers read import batches" on public.inventory_import_batches;
drop policy if exists "managers insert import batches" on public.inventory_import_batches;
drop policy if exists "managers update import batches" on public.inventory_import_batches;
create policy "managers read import batches" on public.inventory_import_batches
for select to authenticated using (public.is_manager());
create policy "managers insert import batches" on public.inventory_import_batches
for insert to authenticated with check (public.is_manager());
create policy "managers update import batches" on public.inventory_import_batches
for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "managers manage import issues" on public.inventory_import_issues;
drop policy if exists "managers read import issues" on public.inventory_import_issues;
drop policy if exists "managers insert import issues" on public.inventory_import_issues;
drop policy if exists "managers update import issues" on public.inventory_import_issues;
create policy "managers read import issues" on public.inventory_import_issues
for select to authenticated using (public.is_manager());
create policy "managers insert import issues" on public.inventory_import_issues
for insert to authenticated with check (public.is_manager());
create policy "managers update import issues" on public.inventory_import_issues
for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "managers manage maintenance records" on public.maintenance_records;
drop policy if exists "managers insert maintenance records" on public.maintenance_records;
drop policy if exists "managers update maintenance records" on public.maintenance_records;
create policy "managers insert maintenance records" on public.maintenance_records
for insert to authenticated with check (public.is_manager());
create policy "managers update maintenance records" on public.maintenance_records
for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "managers manage maintenance evidence" on public.maintenance_evidence;
drop policy if exists "managers insert maintenance evidence" on public.maintenance_evidence;
drop policy if exists "managers update maintenance evidence" on public.maintenance_evidence;
create policy "managers insert maintenance evidence" on public.maintenance_evidence
for insert to authenticated with check (public.is_manager());
create policy "managers update maintenance evidence" on public.maintenance_evidence
for update to authenticated using (public.is_manager()) with check (public.is_manager());

revoke delete on table
  public.hospital_areas,
  public.equipment_types,
  public.manufacturers,
  public.equipment_models,
  public.equipment_locations,
  public.equipment_assets,
  public.equipment_documents,
  public.equipment_document_links,
  public.maintenance_programs,
  public.equipment_maintenance_programs,
  public.risk_assessments,
  public.inventory_import_batches,
  public.inventory_import_issues,
  public.maintenance_records,
  public.maintenance_evidence
from authenticated, anon;

-- A record may remain in progress without started_at for compatibility with
-- historical rows, but it cannot be marked complete without a valid start.
alter table public.maintenance_records
  drop constraint if exists maintenance_records_completed_after_start_check;
alter table public.maintenance_records
  add constraint maintenance_records_completed_after_start_check
  check (
    completed_at is null
    or (started_at is not null and completed_at >= started_at)
  ) not valid;
alter table public.maintenance_records
  validate constraint maintenance_records_completed_after_start_check;

create or replace function public.enforce_maintenance_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if old.status = 'programado' and new.status not in ('en_proceso', 'cancelado') then
      raise exception 'Una orden programada solo puede iniciar o cancelarse';
    elsif old.status = 'en_proceso' and new.status not in ('completado', 'cancelado') then
      raise exception 'Una orden en proceso solo puede completarse o cancelarse';
    elsif old.status in ('completado', 'cancelado') then
      raise exception 'Una orden finalizada no puede reabrirse sin un proceso autorizado';
    end if;

    if new.status = 'completado' and old.scheduled_at > now() then
      raise exception 'Una orden no puede completarse antes de su fecha programada';
    end if;

    if new.status = 'completado' and not exists (
      select 1
      from public.maintenance_records mr
      join public.profiles p on p.id = mr.performed_by
      where mr.maintenance_id = old.id
        and p.active
        and p.role in ('tecnico', 'jefe')
        and mr.started_at is not null
        and mr.completed_at is not null
        and mr.completed_at <= now()
        and nullif(btrim(mr.diagnosis), '') is not null
        and nullif(btrim(mr.work_performed), '') is not null
        and nullif(btrim(mr.test_results), '') is not null
        and mr.equipment_condition is not null
    ) then
      raise exception 'La orden requiere un registro técnico completo antes de cerrarse';
    end if;
  end if;

  if new.status = 'completado' then
    new.completed_at := case
      when old.status = 'completado' then old.completed_at
      else now()
    end;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_maintenance_status_transition on public.maintenances;
create trigger enforce_maintenance_status_transition
before update of status, completed_at on public.maintenances
for each row execute function public.enforce_maintenance_status_transition();

revoke all on function public.enforce_maintenance_status_transition() from public, anon, authenticated;

create or replace function public.update_assigned_maintenance_status(
  target_maintenance_id bigint,
  new_status text
)
returns public.maintenances
language plpgsql
security definer
set search_path = public
as $$
declare updated_row public.maintenances;
begin
  if new_status not in ('programado', 'en_proceso', 'completado', 'cancelado') then
    raise exception 'Estado de mantenimiento no válido';
  end if;

  update public.maintenances
  set status = new_status
  where id = target_maintenance_id
    and (
      public.is_manager()
      or (public.is_active_technician() and assigned_to = auth.uid())
    )
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Orden no encontrada o no autorizada';
  end if;
  return updated_row;
end;
$$;

-- Preserve the administrative RPC signature while rejecting inactive assignees.
create or replace function public.schedule_preventive_maintenance(
  target_equipment_id uuid,
  target_program_id bigint,
  target_scheduled_at timestamptz,
  target_assigned_to uuid default null,
  target_priority text default 'ordinaria'
)
returns public.maintenances
language plpgsql
security definer
set search_path = public
as $$
declare
  equipment_code text;
  created_row public.maintenances;
begin
  if not public.is_manager() then
    raise exception 'Operación reservada para el rol jefe';
  end if;
  if target_scheduled_at is null or target_scheduled_at < now() then
    raise exception 'La fecha programada debe estar en el futuro';
  end if;
  if target_priority not in ('critica', 'alta', 'ordinaria') then
    raise exception 'Prioridad no válida';
  end if;
  if target_assigned_to is not null and not exists (
    select 1 from public.profiles
    where id = target_assigned_to and role = 'tecnico' and active
  ) then
    raise exception 'La persona asignada debe ser un técnico activo';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_equipment_id::text || ':' || target_program_id::text));
  select ea.inventory_code into equipment_code
  from public.equipment_assets ea
  join public.equipment_maintenance_programs ep
    on ep.equipment_id = ea.id and ep.maintenance_program_id = target_program_id
  where ea.id = target_equipment_id and ea.active;
  if equipment_code is null then
    raise exception 'Equipo activo o rutina vinculada no encontrados';
  end if;
  if exists (
    select 1 from public.maintenances
    where equipment_id = target_equipment_id
      and maintenance_program_id = target_program_id
      and scheduled_at::date = target_scheduled_at::date
      and status in ('programado', 'en_proceso')
  ) then
    raise exception 'Ya existe una orden activa para este equipo, rutina y fecha';
  end if;

  insert into public.maintenances (
    maintenance_number, maintenance_code, equipment_identifier, equipment_id,
    maintenance_program_id, status, scheduled_at, assigned_to, created_by, priority
  ) values (
    '', 'MP', equipment_code, target_equipment_id,
    target_program_id, 'programado', target_scheduled_at, target_assigned_to, auth.uid(), target_priority
  ) returning * into created_row;
  return created_row;
end;
$$;

revoke all on function public.search_equipment_directory(text) from public, anon;
revoke all on function public.search_equipment_inventory(text, text, public.risk_level) from public, anon;
revoke all on function public.update_assigned_maintenance_status(bigint, text) from public, anon;
revoke all on function public.schedule_preventive_maintenance(uuid, bigint, timestamptz, uuid, text) from public, anon;
grant execute on function public.search_equipment_directory(text) to authenticated;
grant execute on function public.search_equipment_inventory(text, text, public.risk_level) to authenticated;
grant execute on function public.update_assigned_maintenance_status(bigint, text) to authenticated;
grant execute on function public.schedule_preventive_maintenance(uuid, bigint, timestamptz, uuid, text) to authenticated;

commit;
