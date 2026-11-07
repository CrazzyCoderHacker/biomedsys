-- Datos exclusivamente sintéticos para Supabase Demo.
-- Requiere haber creado primero las tres cuentas indicadas en docs/supabase-demo.md.
begin;

do $$
begin
  if (select count(*) from auth.users where email in (
    '00123456@biomedgest.local',
    '01123456@biomedgest.local',
    '02123456@biomedgest.local'
  )) <> 3 then
    raise exception 'Faltan una o más cuentas Auth de Demo; no se insertó ningún dato';
  end if;
end $$;

insert into public.profiles (id, institutional_id, full_name, role, department, active)
select id, '00123456', 'Jefatura Demo', 'jefe'::public.app_role, 'Ingeniería Clínica Demo', true
from auth.users where email = '00123456@biomedgest.local'
on conflict (institutional_id) do update set
  id = excluded.id, full_name = excluded.full_name, role = excluded.role,
  department = excluded.department, active = true;

insert into public.profiles (id, institutional_id, full_name, role, department, active)
select id, '01123456', 'Técnico Demo', 'tecnico'::public.app_role, 'Ingeniería Clínica Demo', true
from auth.users where email = '01123456@biomedgest.local'
on conflict (institutional_id) do update set
  id = excluded.id, full_name = excluded.full_name, role = excluded.role,
  department = excluded.department, active = true;

insert into public.profiles (id, institutional_id, full_name, role, department, active)
select id, '02123456', 'Usuario Demo', 'usuario'::public.app_role, 'Área Clínica Demo', true
from auth.users where email = '02123456@biomedgest.local'
on conflict (institutional_id) do update set
  id = excluded.id, full_name = excluded.full_name, role = excluded.role,
  department = excluded.department, active = true;

insert into public.hospital_areas (code, name)
values ('DEMO-URG', 'Urgencias Demo')
on conflict (name) do update set code = excluded.code, active = true;

insert into public.equipment_types (name, description)
values ('Monitor sintético', 'Equipo ficticio para demostración; no representa datos hospitalarios.')
on conflict (name) do update set description = excluded.description, active = true;

insert into public.manufacturers (name)
values ('Fabricante Demo')
on conflict (name) do nothing;

insert into public.equipment_models (equipment_type_id, manufacturer_id, name)
select et.id, mf.id, 'Modelo Sintético A'
from public.equipment_types et
cross join public.manufacturers mf
where et.name = 'Monitor sintético' and mf.name = 'Fabricante Demo'
on conflict (equipment_type_id, manufacturer_id, name) do nothing;

insert into public.equipment_locations (hospital_area_id, name)
select id, 'Cubículo Demo 1' from public.hospital_areas where name = 'Urgencias Demo'
on conflict (hospital_area_id, name) do update set active = true;

insert into public.equipment_assets (
  id, inventory_code, equipment_model_id, serial_number, manufacture_year,
  acquisition_year, hospital_area_id, location_id, custodian_location_text,
  status, requires_review, active
)
select
  'd0000000-0000-4000-8000-000000000001'::uuid,
  'EQ-900001', em.id, 'DEMO-SN-001', 2025, 2025, ha.id, el.id,
  'Ubicación exclusivamente sintética', 'operativo'::public.equipment_status,
  false, true
from public.equipment_models em
join public.equipment_types et on et.id = em.equipment_type_id
join public.manufacturers mf on mf.id = em.manufacturer_id
cross join public.hospital_areas ha
join public.equipment_locations el on el.hospital_area_id = ha.id
where et.name = 'Monitor sintético'
  and mf.name = 'Fabricante Demo'
  and em.name = 'Modelo Sintético A'
  and ha.name = 'Urgencias Demo'
  and el.name = 'Cubículo Demo 1'
on conflict (inventory_code) do update set
  equipment_model_id = excluded.equipment_model_id,
  serial_number = excluded.serial_number,
  hospital_area_id = excluded.hospital_area_id,
  location_id = excluded.location_id,
  status = excluded.status,
  active = true;

insert into public.risk_assessments (
  equipment_id, methodology_name, methodology_version,
  function_score, clinical_application_score, maintenance_requirement_score,
  category, assessed_at
)
values (
  'd0000000-0000-4000-8000-000000000001'::uuid,
  'Evaluación sintética Demo', '1.0', 3, 3, 2, 'medio'::public.risk_level, current_date
)
on conflict (equipment_id, methodology_name, methodology_version) do nothing;

insert into public.maintenance_programs (
  name, procedure_text, procedure_sha256, interval_months,
  periodicity_basis, requires_review, active
)
values (
  'Rutina sintética de inspección',
  'Procedimiento ficticio: inspección visual sin intervención clínica.',
  encode(digest('biomedgest-demo-routine-v1', 'sha256'), 'hex'),
  null, null, false, true
)
on conflict (procedure_sha256) do update set active = true;

insert into public.equipment_maintenance_programs (equipment_id, maintenance_program_id)
select 'd0000000-0000-4000-8000-000000000001'::uuid, id
from public.maintenance_programs
where procedure_sha256 = encode(digest('biomedgest-demo-routine-v1', 'sha256'), 'hex')
on conflict (equipment_id, maintenance_program_id) do nothing;

commit;
