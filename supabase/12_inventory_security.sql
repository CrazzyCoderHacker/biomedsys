-- Inventory and maintenance authorization for the three application roles.

create or replace function public.is_technician_or_manager()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('tecnico', 'jefe') and active
  )
$$;

create or replace function public.has_active_profile()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

alter table public.hospital_areas enable row level security;
alter table public.equipment_types enable row level security;
alter table public.manufacturers enable row level security;
alter table public.equipment_models enable row level security;
alter table public.equipment_locations enable row level security;
alter table public.equipment_assets enable row level security;
alter table public.equipment_documents enable row level security;
alter table public.equipment_document_links enable row level security;
alter table public.maintenance_programs enable row level security;
alter table public.equipment_maintenance_programs enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.inventory_import_batches enable row level security;
alter table public.inventory_import_issues enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.maintenance_evidence enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hospital_areas', 'equipment_types', 'manufacturers', 'equipment_models',
    'equipment_locations', 'equipment_assets', 'equipment_documents',
    'equipment_document_links', 'maintenance_programs',
    'equipment_maintenance_programs', 'risk_assessments'
  ] loop
    execute format('drop policy if exists "biomedical staff read %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "biomedical staff read %1$s" on public.%1$I for select to authenticated using (public.is_technician_or_manager())',
      table_name
    );
    execute format('drop policy if exists "managers manage %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "managers manage %1$s" on public.%1$I for all to authenticated using (public.is_manager()) with check (public.is_manager())',
      table_name
    );
  end loop;
end $$;

drop policy if exists "managers manage import batches" on public.inventory_import_batches;
create policy "managers manage import batches" on public.inventory_import_batches
for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "managers manage import issues" on public.inventory_import_issues;
create policy "managers manage import issues" on public.inventory_import_issues
for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "authorized users read maintenance records" on public.maintenance_records;
create policy "authorized users read maintenance records" on public.maintenance_records
for select to authenticated using (
  public.is_manager() or exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
);

drop policy if exists "assigned technicians write maintenance records" on public.maintenance_records;
create policy "assigned technicians write maintenance records" on public.maintenance_records
for all to authenticated using (
  public.is_manager() or exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
) with check (
  public.is_manager() or (
    performed_by = auth.uid() and exists (
      select 1 from public.maintenances m
      where m.id = maintenance_id and m.assigned_to = auth.uid()
    )
  )
);

drop policy if exists "authorized users read maintenance evidence" on public.maintenance_evidence;
create policy "authorized users read maintenance evidence" on public.maintenance_evidence
for select to authenticated using (
  public.is_manager() or exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
);

drop policy if exists "assigned technicians create maintenance evidence" on public.maintenance_evidence;
create policy "assigned technicians create maintenance evidence" on public.maintenance_evidence
for insert to authenticated with check (
  public.is_manager() or (
    uploaded_by = auth.uid() and exists (
      select 1 from public.maintenances m
      where m.id = maintenance_id and m.assigned_to = auth.uid()
    )
  )
);

drop policy if exists "assigned technicians read linked reports" on public.reports;
create policy "assigned technicians read linked reports" on public.reports
for select to authenticated using (
  exists (
    select 1 from public.maintenances m
    where m.id = reports.maintenance_id and m.assigned_to = auth.uid()
  )
);

drop policy if exists "managers update maintenances" on public.maintenances;
create policy "managers update maintenances" on public.maintenances
for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "assigned technicians create activities" on public.maintenance_activities;
create policy "assigned technicians create activities" on public.maintenance_activities
for insert to authenticated with check (
  public.is_manager() or exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
);

drop policy if exists "assigned technicians update activities" on public.maintenance_activities;
create policy "assigned technicians update activities" on public.maintenance_activities
for update to authenticated using (
  public.is_manager() or exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
) with check (
  public.is_manager() or exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id and m.assigned_to = auth.uid()
  )
);

create or replace function public.search_equipment_directory(search_term text default null)
returns table (
  id uuid,
  inventory_code text,
  equipment_type text,
  manufacturer text,
  model text,
  hospital_area text,
  location text,
  status public.equipment_status
)
language sql stable security definer set search_path = public
as $$
  select
    ea.id, ea.inventory_code, et.name, mf.name, em.name,
    ha.name, el.name, ea.status
  from public.equipment_assets ea
  join public.equipment_models em on em.id = ea.equipment_model_id
  join public.equipment_types et on et.id = em.equipment_type_id
  join public.manufacturers mf on mf.id = em.manufacturer_id
  left join public.equipment_locations el on el.id = ea.location_id
  left join public.hospital_areas ha on ha.id = el.hospital_area_id
  where ea.active
    and public.has_active_profile()
    and (
      nullif(btrim(search_term), '') is null or
      ea.inventory_code ilike '%' || btrim(search_term) || '%' or
      et.name ilike '%' || btrim(search_term) || '%' or
      mf.name ilike '%' || btrim(search_term) || '%' or
      em.name ilike '%' || btrim(search_term) || '%' or
      ha.name ilike '%' || btrim(search_term) || '%'
    )
  order by ea.inventory_code
$$;

create or replace function public.update_assigned_maintenance_status(
  target_maintenance_id bigint,
  new_status text
)
returns public.maintenances
language plpgsql security definer set search_path = public
as $$
declare updated_row public.maintenances;
begin
  if new_status not in ('programado', 'en_proceso', 'completado', 'cancelado') then
    raise exception 'Estado de mantenimiento no válido';
  end if;
  update public.maintenances
  set status = new_status,
      completed_at = case when new_status = 'completado' then coalesce(completed_at, now()) else completed_at end
  where id = target_maintenance_id
    and (assigned_to = auth.uid() or public.is_manager())
  returning * into updated_row;
  if updated_row.id is null then
    raise exception 'Orden no encontrada o no autorizada';
  end if;
  return updated_row;
end;
$$;

revoke all on function public.search_equipment_directory(text) from public;
grant execute on function public.search_equipment_directory(text) to authenticated;
revoke all on function public.update_assigned_maintenance_status(bigint, text) from public;
grant execute on function public.update_assigned_maintenance_status(bigint, text) to authenticated;

grant select on public.equipment_inventory_detail to authenticated;
grant select on public.service_orders to authenticated;
