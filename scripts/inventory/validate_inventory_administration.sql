\set ON_ERROR_STOP on

do $$
declare
  asset_count integer;
  issue_count integer;
  shared_serial_count integer;
begin
  select count(*) into asset_count from public.equipment_assets;
  select count(*) into issue_count from public.inventory_import_issues;
  select count(*) into shared_serial_count
  from public.equipment_assets
  where inventory_code in ('EQ-000052', 'EQ-000053')
    and serial_number = '3979000122';
  if asset_count <> 100 then raise exception 'Administration migration changed asset count: %', asset_count; end if;
  if issue_count <> 162 then raise exception 'Administration migration changed issue count: %', issue_count; end if;
  if shared_serial_count <> 2 then raise exception 'The two separate shared-serial assets were not preserved'; end if;
end $$;

-- Clinical users cannot call administrative RPCs.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.update_equipment_asset_admin(
      (select id from public.search_equipment_directory('EQ-000052') limit 1),
      '3979000122', false, null, null,
      (select id from public.hospital_areas limit 1), null, null, 'desconocido'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Clinical user executed manager equipment RPC'; end if;
end $$;
reset role;

-- Technicians also remain blocked from manager administration.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.configure_equipment_preventive_program(
      (select id from public.equipment_assets where inventory_code = 'EQ-000052'),
      (select maintenance_program_id from public.equipment_maintenance_programs
       where equipment_id = (select id from public.equipment_assets where inventory_code = 'EQ-000052') limit 1),
      6::smallint, 'Prueba local', null, current_date, null
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Technician configured manager periodicity'; end if;
end $$;
reset role;

-- Manager configures one asset without changing the shared routine globally.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);

select (public.update_equipment_asset_admin(
  (select id from public.equipment_assets where inventory_code = 'EQ-000052'),
  '3979000122', false,
  (select manufacture_year from public.equipment_assets where inventory_code = 'EQ-000052'),
  (select acquisition_year from public.equipment_assets where inventory_code = 'EQ-000052'),
  (select hospital_area_id from public.equipment_assets where inventory_code = 'EQ-000052'),
  (select location_id from public.equipment_assets where inventory_code = 'EQ-000052'),
  (select custodian_location_text from public.equipment_assets where inventory_code = 'EQ-000052'),
  'desconocido'
)).inventory_code;

select (public.configure_equipment_preventive_program(
  (select id from public.equipment_assets where inventory_code = 'EQ-000052'),
  (select maintenance_program_id from public.equipment_maintenance_programs
   where equipment_id = (select id from public.equipment_assets where inventory_code = 'EQ-000052') limit 1),
  6::smallint, 'Manual del fabricante', 'Configuración de validación local', current_date, null
)).interval_months;

do $$
declare
  configured_count integer;
  global_changed integer;
  due_date date;
begin
  select count(*), max(next_due_on) into configured_count, due_date
  from public.equipment_maintenance_programs
  where equipment_id = (select id from public.equipment_assets where inventory_code = 'EQ-000052')
    and interval_months = 6;
  select count(*) into global_changed from public.maintenance_programs where interval_months is not null;
  if configured_count <> 1 then raise exception 'Asset periodicity configuration failed'; end if;
  if global_changed <> 0 then raise exception 'Shared maintenance program was changed globally'; end if;
  if due_date <> (current_date + interval '6 months')::date then raise exception 'Next due date was not calculated correctly'; end if;
end $$;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.schedule_preventive_maintenance(
      (select id from public.equipment_assets where inventory_code = 'EQ-000052'),
      (select maintenance_program_id from public.equipment_maintenance_programs
       where equipment_id = (select id from public.equipment_assets where inventory_code = 'EQ-000052') limit 1),
      now() + interval '9 days',
      '00000000-0000-0000-0000-000000000003', 'ordinaria'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Preventive order was assigned to a non-technician'; end if;
end $$;

select (public.schedule_preventive_maintenance(
  (select id from public.equipment_assets where inventory_code = 'EQ-000052'),
  (select maintenance_program_id from public.equipment_maintenance_programs
   where equipment_id = (select id from public.equipment_assets where inventory_code = 'EQ-000052') limit 1),
  date_trunc('day', now() + interval '10 days') + interval '9 hours',
  '00000000-0000-0000-0000-000000000002', 'ordinaria'
)).maintenance_number;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.schedule_preventive_maintenance(
      (select id from public.equipment_assets where inventory_code = 'EQ-000052'),
      (select maintenance_program_id from public.equipment_maintenance_programs
       where equipment_id = (select id from public.equipment_assets where inventory_code = 'EQ-000052') limit 1),
      date_trunc('day', now() + interval '10 days') + interval '10 hours',
      null, 'ordinaria'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Duplicate preventive order was created'; end if;
end $$;

select (public.review_inventory_issue(
  (select i.id from public.inventory_import_issues i
   join public.equipment_assets a on a.id = i.equipment_id
   where a.inventory_code = 'EQ-000052' and i.issue_code = 'duplicate_serial' limit 1),
  'confirmado',
  'Se confirmó que existen dos registros de activos independientes; el serial requiere evidencia adicional.',
  'Revisión local del flujo, sin modificar el valor importado.',
  'Referencia de validación local'
)).review_status;

do $$
declare
  asset_count integer;
  issue_count integer;
  review_count integer;
  audit_count integer;
begin
  select count(*) into asset_count from public.equipment_assets;
  select count(*) into issue_count from public.inventory_import_issues;
  select count(*) into review_count from public.inventory_issue_reviews;
  select count(*) into audit_count from public.audit_log
  where entity_type in ('equipment_assets', 'equipment_maintenance_programs', 'inventory_import_issues', 'inventory_issue_reviews', 'maintenances');
  if asset_count <> 100 then raise exception 'Admin workflow changed asset count'; end if;
  if issue_count <> 162 then raise exception 'Admin workflow deleted an original issue'; end if;
  if review_count <> 1 then raise exception 'Issue review history was not retained'; end if;
  if audit_count < 5 then raise exception 'Expected inventory audit entries, got %', audit_count; end if;
end $$;
reset role;

select 'INVENTORY_ADMINISTRATION_VALIDATION_COMPLETE' as result;
