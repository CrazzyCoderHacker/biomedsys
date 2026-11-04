\set ON_ERROR_STOP on

-- Fixed test identities. They exist only in the disposable local database.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000001', 'manager@local.test', now()),
  ('00000000-0000-0000-0000-000000000002', 'technician@local.test', now()),
  ('00000000-0000-0000-0000-000000000003', 'clinical@local.test', now())
on conflict (id) do nothing;

insert into public.profiles (id, institutional_id, full_name, role, department) values
  ('00000000-0000-0000-0000-000000000001', '00100001', 'Jefe local', 'jefe', 'Ingeniería Clínica'),
  ('00000000-0000-0000-0000-000000000002', '01100002', 'Técnico local', 'tecnico', 'Ingeniería Clínica'),
  ('00000000-0000-0000-0000-000000000003', '02100003', 'Usuario local', 'usuario', 'Área Clínica')
on conflict (institutional_id) do update set role = excluded.role, active = true;

do $$
declare value_count integer;
begin
  select count(*) into value_count from public.equipment_assets;
  if value_count <> 100 then raise exception 'Expected 100 assets, got %', value_count; end if;
  select count(*) into value_count from public.risk_assessments;
  if value_count <> 100 then raise exception 'Expected 100 risk assessments, got %', value_count; end if;
  select count(*) into value_count from public.maintenance_programs;
  if value_count <> 44 then raise exception 'Expected 44 programs, got %', value_count; end if;
  select count(*) into value_count from public.equipment_maintenance_programs;
  if value_count <> 100 then raise exception 'Expected 100 asset-program links, got %', value_count; end if;
  select count(*) into value_count from public.equipment_documents;
  if value_count <> 111 then raise exception 'Expected 111 unique documents, got %', value_count; end if;
  select count(*) into value_count from public.equipment_document_links;
  if value_count <> 199 then raise exception 'Expected 199 document links, got %', value_count; end if;
  select count(*) into value_count from public.inventory_import_issues;
  if value_count <> 162 then raise exception 'Expected 162 review issues, got %', value_count; end if;
  raise notice 'PASS: inventory import counts';
end $$;

-- User: limited RPC directory, own reports, no base inventory access.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);

do $$
declare value_count integer; affected integer; blocked boolean := false;
begin
  select count(*) into value_count from public.search_equipment_directory(null);
  if value_count <> 100 then raise exception 'Clinical directory expected 100, got %', value_count; end if;
  select count(*) into value_count from public.search_equipment_inventory(null, null, null);
  if value_count <> 0 then raise exception 'Clinical role exposed full inventory RPC: %', value_count; end if;
  select count(*) into value_count from public.equipment_assets;
  if value_count <> 0 then raise exception 'Clinical role exposed base assets: %', value_count; end if;
  select count(*) into value_count from public.equipment_inventory_detail;
  if value_count <> 0 then raise exception 'Clinical role exposed detail view: %', value_count; end if;
  begin
    insert into public.equipment_assets (
      inventory_code, equipment_model_id, manufacture_year, acquisition_year,
      hospital_area_id, status
    ) values ('EQ-999999', 1, 2020, 2021, 1, 'desconocido');
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'Clinical role inserted an asset'; end if;
  update public.equipment_assets set status = 'operativo' where inventory_code = 'EQ-000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Clinical role updated an asset'; end if;
  raise notice 'PASS: clinical inventory permissions';
end $$;

insert into public.reports (
  equipment_identifier, equipment_id, event_date, event_type, service, description
)
select inventory_code, id, current_date, 'falla', 'Urgencias', 'Reporte de validación local'
from public.search_equipment_directory('EQ-000001');

do $$
declare value_count integer;
begin
  select count(*) into value_count from public.reports where reporter_id = auth.uid();
  if value_count <> 1 then raise exception 'Clinical report insert/read failed: %', value_count; end if;
  raise notice 'PASS: clinical report relation';
end $$;
reset role;

-- Manager: full inventory, creates and links a service order.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

do $$
declare value_count integer; affected integer;
begin
  select count(*) into value_count from public.equipment_assets;
  if value_count <> 100 then raise exception 'Manager expected 100 assets, got %', value_count; end if;
  select count(*) into value_count from public.inventory_import_issues;
  if value_count <> 162 then raise exception 'Manager expected 162 issues, got %', value_count; end if;
  select count(*) into value_count from public.search_equipment_inventory('mindray', null, 'alto');
  if value_count < 1 then raise exception 'Manager inventory search/filter returned no results'; end if;
  update public.equipment_assets set status = 'operativo' where inventory_code = 'EQ-000100';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Manager could not update asset'; end if;
  raise notice 'PASS: manager inventory permissions';
end $$;

insert into public.maintenances (
  maintenance_number, maintenance_code, equipment_identifier, equipment_id,
  status, scheduled_at, assigned_to, created_by
)
select '', 'MC', inventory_code, id, 'programado', now() + interval '1 day',
  '00000000-0000-0000-0000-000000000002', auth.uid()
from public.equipment_assets where inventory_code = 'EQ-000001';

update public.reports
set maintenance_id = (select id from public.maintenances where equipment_identifier = 'EQ-000001' limit 1)
where reporter_id = '00000000-0000-0000-0000-000000000003';

do $$
declare value_count integer;
begin
  select count(*) into value_count from public.service_orders
  where equipment_id = (select id from public.equipment_assets where inventory_code = 'EQ-000001')
    and report_id is not null;
  if value_count <> 1 then raise exception 'Report/service order/equipment relation failed: %', value_count; end if;
  raise notice 'PASS: report and service-order relationship';
end $$;
reset role;

-- Technician: full read access, only assigned operational writes.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);

do $$
declare value_count integer; affected integer;
begin
  select count(*) into value_count from public.equipment_assets;
  if value_count <> 100 then raise exception 'Technician expected 100 assets, got %', value_count; end if;
  select count(*) into value_count from public.search_equipment_inventory(null, null, null);
  if value_count <> 100 then raise exception 'Technician inventory RPC expected 100, got %', value_count; end if;
  select count(*) into value_count from public.maintenances where assigned_to = auth.uid();
  if value_count <> 1 then raise exception 'Technician assigned order visibility failed: %', value_count; end if;
  select count(*) into value_count from public.reports;
  if value_count <> 1 then raise exception 'Technician linked report visibility failed: %', value_count; end if;
  select count(*) into value_count from public.inventory_import_issues;
  if value_count <> 0 then raise exception 'Technician exposed import issues: %', value_count; end if;
  update public.equipment_assets set status = 'fuera_de_servicio' where inventory_code = 'EQ-000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Technician updated inventory master data'; end if;
  update public.maintenances set priority = 'critica' where assigned_to = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Technician bypassed status RPC'; end if;
  raise notice 'PASS: technician read and master-data restrictions';
end $$;

select (public.update_assigned_maintenance_status(
  (select id from public.maintenances where assigned_to = auth.uid() limit 1),
  'en_proceso'
)).maintenance_number;

insert into public.maintenance_activities (maintenance_id, activity, completed)
select id, 'Actividad de validación local', true
from public.maintenances where assigned_to = auth.uid();

insert into public.maintenance_records (
  maintenance_id, performed_by, started_at, diagnosis, work_performed, equipment_condition
)
select id, auth.uid(), now(), 'Diagnóstico local', 'Prueba local', 'en_reparacion'
from public.maintenances where assigned_to = auth.uid();

do $$
declare value_count integer;
begin
  select count(*) into value_count from public.maintenance_activities;
  if value_count <> 1 then raise exception 'Technician activity insert failed: %', value_count; end if;
  select count(*) into value_count from public.maintenance_records;
  if value_count <> 1 then raise exception 'Technician maintenance record insert failed: %', value_count; end if;
  delete from public.maintenance_records where performed_by = auth.uid();
  get diagnostics value_count = row_count;
  if value_count <> 0 then raise exception 'Technician deleted a maintenance record'; end if;
  select count(*) into value_count from public.maintenances where status = 'en_proceso';
  if value_count <> 1 then raise exception 'Technician status RPC failed: %', value_count; end if;
  raise notice 'PASS: technician assigned-order workflow';
end $$;
reset role;

-- Constraint checks as database owner.
do $$
declare blocked boolean;
begin
  blocked := false;
  begin
    insert into public.risk_assessments (
      equipment_id, methodology_version, function_score,
      clinical_application_score, maintenance_requirement_score, category
    ) select id, 'invalid-test', 9, 5, 5, 'bajo'
      from public.equipment_assets where inventory_code = 'EQ-000001';
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'Risk category constraint did not reject invalid data'; end if;

  blocked := false;
  begin
    insert into public.reports (
      reporter_id, equipment_identifier, equipment_id, event_date, event_type, service, description
    ) values (
      '00000000-0000-0000-0000-000000000001', 'invalid',
      'ffffffff-ffff-ffff-ffff-ffffffffffff', current_date, 'falla', 'Prueba', 'FK inválida'
    );
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'Equipment foreign key did not reject invalid data'; end if;

  blocked := false;
  begin
    insert into public.equipment_assets (
      inventory_code, equipment_model_id, manufacture_year, acquisition_year,
      hospital_area_id, location_id, status
    )
    select 'EQ-999998', 1, 2020, 2021,
      (select id from public.hospital_areas order by id desc limit 1),
      (select id from public.equipment_locations order by id limit 1),
      'desconocido';
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'Location/area foreign key did not reject inconsistent data'; end if;
  raise notice 'PASS: risk check and equipment foreign key constraints';
end $$;

select 'VALIDATION_COMPLETE' as result;
