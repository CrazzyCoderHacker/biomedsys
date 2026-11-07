\set ON_ERROR_STOP on

-- Disposable end-to-end scenario for migration 15.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000004', 'second-technician@local.test', now())
on conflict (id) do nothing;
insert into public.profiles (id, institutional_id, full_name, role, department) values
  ('00000000-0000-0000-0000-000000000004', '01100004', 'Segundo técnico local', 'tecnico', 'Ingeniería Clínica')
on conflict (institutional_id) do update set role = excluded.role, active = true;

-- Active user creates a report with the actual equipment UUID and can read it later.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
insert into public.reports (
  equipment_identifier, equipment_id, event_date, event_type, service,
  description, patient_outcome, action_taken
)
select inventory_code, id, current_date, 'falla', 'Terapia intensiva',
       'Flujo correctivo integral local', 'Sin afectación', 'Equipo aislado'
from public.search_equipment_directory('EQ-000002');

do $$
declare blocked boolean := false;
begin
  if (select count(*) from public.reports where description = 'Flujo correctivo integral local') <> 1 then
    raise exception 'User could not recover the new report';
  end if;
  begin
    perform public.create_corrective_order_from_report(
      (select id from public.reports where description = 'Flujo correctivo integral local'),
      '00000000-0000-0000-0000-000000000002', 'alta', now() - interval '1 minute'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'User created a corrective order'; end if;
end $$;
reset role;

-- Manager classifies, assigns and creates exactly one order in one transaction.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select (public.create_corrective_order_from_report(
  (select id from public.reports where description = 'Flujo correctivo integral local'),
  '00000000-0000-0000-0000-000000000002', 'alta', now() - interval '1 minute'
)).maintenance_number;

do $$
declare blocked boolean := false;
begin
  if not exists (
    select 1 from public.reports r
    join public.maintenances m on m.id = r.maintenance_id
    where r.description = 'Flujo correctivo integral local'
      and r.status = 'Asignado' and r.priority = 'Alta'
      and m.source_report_id = r.id and m.maintenance_code = 'MC'
      and m.assigned_to = '00000000-0000-0000-0000-000000000002'
  ) then raise exception 'Transactional report/order relation failed'; end if;

  begin
    perform public.create_corrective_order_from_report(
      (select id from public.reports where description = 'Flujo correctivo integral local'),
      '00000000-0000-0000-0000-000000000002', 'alta', now()
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Duplicate corrective order was accepted'; end if;

  blocked := false;
  begin
    update public.reports set status = 'Cerrado'
    where description = 'Flujo correctivo integral local';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Manager bypassed transactional report RPC'; end if;
end $$;
reset role;

-- A different active technician cannot see or modify the assigned order.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
do $$
declare blocked boolean := false;
begin
  if (select count(*) from public.maintenances where source_report_id = (
    select id from public.reports where description = 'Flujo correctivo integral local'
  )) <> 0 then raise exception 'Unassigned technician read the order'; end if;
  begin
    perform public.update_assigned_maintenance_status(
      (select id from public.maintenances where equipment_identifier = 'EQ-000002'), 'en_proceso'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Unassigned technician changed the order'; end if;
end $$;
reset role;

-- Assigned technician starts the work. Manager cannot close an incomplete file.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select (public.update_assigned_maintenance_status(
  (select id from public.maintenances where equipment_identifier = 'EQ-000002'), 'en_proceso'
)).maintenance_number;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.validate_corrective_closure(
      (select id from public.maintenances where equipment_identifier = 'EQ-000002'), 'Intento anticipado'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Manager closed an order without a technical file'; end if;
end $$;
reset role;

-- Technician saves a draft, cannot close it, then submits a complete file.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select (public.save_corrective_intervention(
  (select id from public.maintenances where equipment_identifier = 'EQ-000002'),
  now() - interval '2 hours', null, 'Diagnóstico preliminar',
  'Inspección y corrección', null, 'en_reparacion', 'Borrador local'
)).id;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.update_assigned_maintenance_status(
      (select id from public.maintenances where equipment_identifier = 'EQ-000002'), 'completado'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Technician bypassed manager closure validation'; end if;
end $$;

select (public.save_corrective_intervention(
  (select id from public.maintenances where equipment_identifier = 'EQ-000002'),
  now() - interval '2 hours', now(), 'Falla de conexión interna',
  'Se aseguró el conector y se realizó limpieza', 'Pruebas funcionales conformes',
  'operativo', 'Sin evidencia: Storage no configurado en local'
)).id;

do $$
begin
  if (select status from public.reports where description = 'Flujo correctivo integral local') <> 'Resuelto' then
    raise exception 'Completed technical file did not mark report as resolved';
  end if;
end $$;
reset role;

-- Manager validates; order and report close atomically and preserve traceability.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select (public.validate_corrective_closure(
  (select id from public.maintenances where equipment_identifier = 'EQ-000002'),
  'Expediente revisado y cierre autorizado'
)).maintenance_number;
reset role;

do $$
declare
  report_id bigint;
  maintenance_key bigint;
begin
  select id, maintenance_id into report_id, maintenance_key
  from public.reports where description = 'Flujo correctivo integral local';
  if not exists (
    select 1 from public.reports r
    join public.maintenances m on m.id = r.maintenance_id
    join public.maintenance_records mr on mr.maintenance_id = m.id
    where r.id = report_id and r.status = 'Cerrado'
      and m.status = 'completado' and m.source_report_id = r.id
      and m.validated_by = '00000000-0000-0000-0000-000000000001'
      and m.validated_at is not null and mr.completed_at is not null
  ) then raise exception 'Atomic corrective closure or relations failed'; end if;
  if (select count(*) from public.maintenances where source_report_id = report_id) <> 1 then
    raise exception 'Corrective order count is not exactly one';
  end if;
  if (select count(*) from public.audit_log where entity_type = 'reports' and entity_id = report_id::text) < 4 then
    raise exception 'Report audit trail is incomplete';
  end if;
  if (select count(*) from public.audit_log where entity_type = 'maintenances' and entity_id = maintenance_key::text) < 3 then
    raise exception 'Maintenance audit trail is incomplete';
  end if;
  if (select count(*) from public.audit_log where entity_type = 'maintenance_records' and entity_id = (
    select id::text from public.maintenance_records where maintenance_id = maintenance_key
  )) < 2 then raise exception 'Technical record audit trail is incomplete'; end if;
end $$;

-- An inactive technician cannot be assigned to a new report.
update public.profiles set active = false where id = '00000000-0000-0000-0000-000000000004';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
insert into public.reports (
  equipment_identifier, equipment_id, event_date, event_type, service, description
)
select inventory_code, id, current_date, 'falla', 'Urgencias', 'Reporte para técnico inactivo'
from public.search_equipment_directory('EQ-000003');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.create_corrective_order_from_report(
      (select id from public.reports where description = 'Reporte para técnico inactivo'),
      '00000000-0000-0000-0000-000000000004', 'ordinaria', now()
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Inactive technician received a corrective order'; end if;
end $$;
reset role;
update public.profiles set active = true where id = '00000000-0000-0000-0000-000000000004';

do $$
begin
  if (select count(*) from public.equipment_assets) <> 100 then raise exception 'Workflow changed inventory count'; end if;
  if (select count(*) from public.risk_assessments) <> 100 then raise exception 'Workflow changed risk count'; end if;
end $$;

select 'CORRECTIVE_WORKFLOW_VALIDATION_COMPLETE' as result;
