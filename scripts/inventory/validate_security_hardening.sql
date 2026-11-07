\set ON_ERROR_STOP on

-- SEC-01: active sessions work; inactive profiles lose every application capability.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$
begin
  if not public.has_active_profile() then raise exception 'Active clinical profile was rejected'; end if;
  if public.is_manager() or public.is_technician_or_manager() then
    raise exception 'Active clinical profile inherited a privileged role';
  end if;
  if (select count(*) from public.search_equipment_directory(null)) <> 100 then
    raise exception 'Active clinical directory failed';
  end if;
  if (select count(*) from public.equipment_assets) <> 0 then
    raise exception 'Clinical profile bypassed direct inventory RLS';
  end if;
end $$;
reset role;

update public.profiles set active = false where id = '00000000-0000-0000-0000-000000000003';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$
declare blocked boolean := false;
begin
  if public.has_active_profile() or public.is_manager()
     or public.is_technician_or_manager() or public.is_active_technician() then
    raise exception 'Inactive clinical profile retained an application role';
  end if;
  if (select count(*) from public.profiles) <> 0 then raise exception 'Inactive user read its profile'; end if;
  if (select count(*) from public.search_equipment_directory(null)) <> 0 then raise exception 'Inactive user read inventory directory'; end if;
  if (select count(*) from public.reports) <> 0 then raise exception 'Inactive user read its reports'; end if;
  if (select count(*) from public.trainings) <> 0 then raise exception 'Inactive user read trainings'; end if;
  begin
    insert into public.reports (equipment_identifier, event_date, event_type, service, description)
    values ('EQ-000001', current_date, 'falla', 'Prueba', 'Debe ser rechazado');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Inactive user created a report'; end if;
end $$;
reset role;
update public.profiles set active = true where id = '00000000-0000-0000-0000-000000000003';

update public.profiles set active = true where id = '00000000-0000-0000-0000-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$
begin
  if not public.has_active_profile() or not public.is_active_technician()
     or not public.is_technician_or_manager() or public.is_manager() then
    raise exception 'Active technician role predicates are inconsistent';
  end if;
  if (select count(*) from public.equipment_assets) <> 100 then
    raise exception 'Active technician lost direct inventory RLS access';
  end if;
end $$;
reset role;

update public.profiles set active = false where id = '00000000-0000-0000-0000-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$
declare blocked boolean := false;
begin
  if public.has_active_profile() or public.is_active_technician()
     or public.is_technician_or_manager() or public.is_manager() then
    raise exception 'Inactive technician retained an application role';
  end if;
  if (select count(*) from public.equipment_assets) <> 0 then raise exception 'Inactive technician bypassed inventory RLS'; end if;
  if (select count(*) from public.search_equipment_inventory(null, null, null)) <> 0 then raise exception 'Inactive technician read technical inventory'; end if;
  if (select count(*) from public.maintenances) <> 0 then raise exception 'Inactive technician read assigned orders'; end if;
  begin
    perform public.update_assigned_maintenance_status(1, 'en_proceso');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Inactive technician updated an order'; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.schedule_preventive_maintenance(
      (select id from public.equipment_assets where inventory_code = 'EQ-000052'),
      (select maintenance_program_id from public.equipment_maintenance_programs
       where equipment_id = (select id from public.equipment_assets where inventory_code = 'EQ-000052') limit 1),
      now() + interval '20 days',
      '00000000-0000-0000-0000-000000000002',
      'ordinaria'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Manager assigned preventive work to inactive technician'; end if;
end $$;
reset role;
update public.profiles set active = true where id = '00000000-0000-0000-0000-000000000002';

update public.profiles set active = true where id = '00000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
begin
  if not public.has_active_profile() or not public.is_manager()
     or not public.is_technician_or_manager() or public.is_active_technician() then
    raise exception 'Active manager role predicates are inconsistent';
  end if;
  if (select count(*) from public.equipment_assets) <> 100 then
    raise exception 'Active manager lost direct inventory RLS access';
  end if;
end $$;
reset role;

update public.profiles set active = false where id = '00000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
declare blocked boolean := false;
begin
  if public.has_active_profile() or public.is_manager()
     or public.is_technician_or_manager() or public.is_active_technician() then
    raise exception 'Inactive manager retained an application role';
  end if;
  if (select count(*) from public.equipment_assets) <> 0 then raise exception 'Inactive manager read inventory'; end if;
  if (select count(*) from public.audit_log) <> 0 then raise exception 'Inactive manager read audit history'; end if;
  begin
    perform public.update_equipment_asset_admin(null, null, false, null, null, null, null, null, 'desconocido');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Inactive manager executed an administrative RPC'; end if;
end $$;
reset role;
update public.profiles set active = true where id = '00000000-0000-0000-0000-000000000001';

do $$
declare unsafe_policies text[];
begin
  select array_agg(format('%I.%I', tablename, policyname) order by tablename, policyname)
  into unsafe_policies
  from pg_policies
  where schemaname = 'public'
    and 'authenticated' = any(roles)
    and permissive = 'PERMISSIVE'
    and (
      (cmd in ('SELECT', 'UPDATE', 'DELETE', 'ALL') and coalesce(btrim(qual), 'true') = 'true')
      or (cmd in ('INSERT', 'UPDATE', 'ALL') and coalesce(btrim(with_check), btrim(qual), 'true') = 'true')
    );
  if unsafe_policies is not null then
    raise exception 'Permissive authenticated policies bypass active-profile checks: %', unsafe_policies;
  end if;
end $$;

-- SEC-02: a manager retains insert/update capabilities but not destructive deletion.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
declare affected integer; blocked boolean;
begin
  update public.equipment_assets set status = status where inventory_code = 'EQ-000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Manager lost legitimate equipment update'; end if;

  blocked := false;
  begin delete from public.equipment_assets where inventory_code = 'EQ-000001';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Manager retained direct equipment DELETE privilege'; end if;

  blocked := false;
  begin delete from public.manufacturers where false;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Manager retained direct catalog DELETE privilege'; end if;

  blocked := false;
  begin delete from public.inventory_import_issues where false;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Manager retained direct import-issue DELETE privilege'; end if;
end $$;
reset role;

do $$
begin
  if has_table_privilege('authenticated', 'public.equipment_assets', 'DELETE') then
    raise exception 'authenticated still has equipment DELETE table privilege';
  end if;
  if has_table_privilege('authenticated', 'public.manufacturers', 'DELETE') then
    raise exception 'authenticated still has manufacturer DELETE table privilege';
  end if;
  if has_table_privilege('authenticated', 'public.equipment_maintenance_programs', 'DELETE') then
    raise exception 'authenticated still has equipment-program DELETE table privilege';
  end if;
  if has_function_privilege('anon', 'public.search_equipment_directory(text)', 'EXECUTE') then
    raise exception 'anon can execute search_equipment_directory';
  end if;
  if has_function_privilege('anon', 'public.is_manager()', 'EXECUTE') then
    raise exception 'anon can execute is_manager';
  end if;
  if has_function_privilege('anon', 'public.update_assigned_maintenance_status(bigint,text)', 'EXECUTE') then
    raise exception 'anon can execute status RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.search_equipment_directory(text)', 'EXECUTE') then
    raise exception 'authenticated lost directory RPC';
  end if;
end $$;

-- OPS-02: completion needs a complete record and terminal states cannot reopen.
update public.maintenances set scheduled_at = now() - interval '1 day' where id = 1;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
do $$
declare blocked boolean := false;
begin
  begin perform public.update_assigned_maintenance_status(1, 'completado');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Order completed without a complete technical record'; end if;
end $$;

select (public.save_corrective_intervention(
  1, now() - interval '2 hours', now(),
  'Diagnóstico local', 'Prueba local', 'Pruebas funcionales conformes',
  'operativo', 'Expediente listo para validación'
)).id;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select (public.validate_corrective_closure(1, 'Cierre validado localmente')).maintenance_number;

do $$
declare blocked boolean := false;
begin
  begin perform public.update_assigned_maintenance_status(1, 'en_proceso');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Completed order was reopened'; end if;
  if (select completed_at is null from public.maintenances where id = 1) then
    raise exception 'Completed order has no completion timestamp';
  end if;
end $$;
reset role;

-- The preventive order created by administration validation is still programado and may cancel once.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select (public.update_assigned_maintenance_status(2, 'cancelado')).maintenance_number;
do $$
declare blocked boolean := false;
begin
  begin perform public.update_assigned_maintenance_status(2, 'programado');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Cancelled order was reopened'; end if;
  if (select completed_at is not null from public.maintenances where id = 2) then
    raise exception 'Cancelled order retained completed_at';
  end if;
end $$;
reset role;

do $$
declare blocked boolean := false;
begin
  begin
    insert into public.maintenance_records (
      maintenance_id, performed_by, started_at, completed_at,
      diagnosis, work_performed, test_results, equipment_condition
    ) values (
      2, '00000000-0000-0000-0000-000000000002', null, now(),
      'Prueba inválida', 'Prueba inválida', 'Prueba inválida', 'operativo'
    );
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'Maintenance record completed without started_at'; end if;

  blocked := false;
  begin
    insert into public.maintenance_records (
      maintenance_id, performed_by, started_at, completed_at,
      diagnosis, work_performed, test_results, equipment_condition
    ) values (
      2, '00000000-0000-0000-0000-000000000002', now(), now() - interval '1 hour',
      'Prueba inválida', 'Prueba inválida', 'Prueba inválida', 'operativo'
    );
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'Maintenance record accepted completed_at before started_at'; end if;
end $$;

do $$
begin
  if (select count(*) from public.equipment_assets) <> 100 then raise exception 'Security tests changed asset count'; end if;
  if (select count(*) from public.risk_assessments) <> 100 then raise exception 'Security tests changed risk count'; end if;
  if (select count(*) from public.inventory_import_issues) <> 162 then raise exception 'Security tests changed issue count'; end if;
  if (select count(*) from public.profiles where not active) <> 0 then raise exception 'Security tests left inactive profiles'; end if;
end $$;

select 'SECURITY_HARDENING_VALIDATION_COMPLETE' as result;
