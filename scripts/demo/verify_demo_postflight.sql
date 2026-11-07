-- Verificación de solo lectura para ejecutar tras migraciones y semilla Demo.
do $$
declare missing text;
begin
  select string_agg(required.name, ', ' order by required.name) into missing
  from (values
    ('create_corrective_order_from_report'),
    ('save_corrective_intervention'),
    ('update_assigned_maintenance_status'),
    ('validate_corrective_closure'),
    ('save_preventive_intervention'),
    ('validate_preventive_closure'),
    ('manage_profile'),
    ('save_quote_items'),
    ('deactivate_attachment'),
    ('complete_password_change'),
    ('get_profile_activity'),
    ('get_equipment_activity')
  ) required(name)
  where not exists (
    select 1 from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = required.name
  );
  if missing is not null then
    raise exception 'Faltan RPC: %', missing;
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in (
        'create_corrective_order_from_report', 'save_corrective_intervention',
        'update_assigned_maintenance_status', 'validate_corrective_closure',
        'save_preventive_intervention', 'validate_preventive_closure',
        'manage_profile', 'save_quote_items', 'deactivate_attachment',
        'complete_password_change', 'get_profile_activity', 'get_equipment_activity'
      )
      and grantee in ('PUBLIC', 'anon')
      and privilege_type = 'EXECUTE'
  ) then
    raise exception 'Una RPC correctiva conserva EXECUTE para PUBLIC o anon';
  end if;

  if (select count(*) from public.profiles where institutional_id in ('00123456','01123456','02123456') and active) <> 3 then
    raise exception 'No existen los tres perfiles activos de Demo';
  end if;
  if (select count(*) from public.equipment_assets where inventory_code = 'EQ-900001') <> 1 then
    raise exception 'El equipo sintético Demo no existe exactamente una vez';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public') < 1 then
    raise exception 'No se encontraron políticas RLS';
  end if;
  if to_regclass('public.file_attachments') is null or to_regclass('public.notifications') is null
     or to_regclass('public.quote_items') is null or to_regclass('public.quote_status_history') is null then
    raise exception 'Las tablas de finalización no están instaladas';
  end if;
end $$;

select json_build_object(
  'demo_profiles', (select count(*) from public.profiles where institutional_id in ('00123456','01123456','02123456')),
  'demo_equipment', (select count(*) from public.equipment_assets where inventory_code like 'EQ-9%'),
  'rls_tables', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relrowsecurity),
  'policies', (select count(*) from pg_policies where schemaname = 'public'),
  'corrective_rpcs', (select count(distinct proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in (
    'create_corrective_order_from_report', 'save_corrective_intervention',
    'update_assigned_maintenance_status', 'validate_corrective_closure'
  )),
  'audit_triggers', (select count(*) from pg_trigger where not tgisinternal and tgname in (
    'audit_reports', 'audit_maintenances', 'audit_maintenance_records',
    'audit_maintenance_activities', 'audit_maintenance_evidence'
  ))
) as demo_postflight;
