alter table public.profiles enable row level security;
alter table public.maintenance_catalog enable row level security;
alter table public.maintenances enable row level security;
alter table public.maintenance_activities enable row level security;
alter table public.reports enable row level security;
alter table public.trainings enable row level security;
alter table public.training_participants enable row level security;
alter table public.quotes enable row level security;
alter table public.audit_log enable row level security;
alter table public.user_access_requests enable row level security;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.profiles
  where id = auth.uid() and role = 'jefe' and active
) $$;

drop policy if exists "users read their profile" on public.profiles;
create policy "users read their profile" on public.profiles
for select using (id = auth.uid() or public.is_manager());

drop policy if exists "authenticated users read maintenance catalog" on public.maintenance_catalog;
create policy "authenticated users read maintenance catalog" on public.maintenance_catalog
for select to authenticated using (true);

drop policy if exists "authorized users read maintenances" on public.maintenances;
create policy "authorized users read maintenances" on public.maintenances
for select to authenticated using (created_by = auth.uid() or assigned_to = auth.uid() or public.is_manager());

drop policy if exists "managers create maintenances" on public.maintenances;
create policy "managers create maintenances" on public.maintenances
for insert to authenticated with check (public.is_manager() and created_by = auth.uid());

drop policy if exists "authorized users read activities" on public.maintenance_activities;
create policy "authorized users read activities" on public.maintenance_activities
for select to authenticated using (
  exists (
    select 1 from public.maintenances m
    where m.id = maintenance_id
      and (m.created_by = auth.uid() or m.assigned_to = auth.uid() or public.is_manager())
  )
);

drop policy if exists "authenticated users create reports" on public.reports;
create policy "authenticated users create reports" on public.reports
for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "users read own reports" on public.reports;
create policy "users read own reports" on public.reports
for select to authenticated using (reporter_id = auth.uid() or public.is_manager());

drop policy if exists "managers update reports" on public.reports;
create policy "managers update reports" on public.reports
for update to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "clinicians read trainings" on public.trainings;
create policy "clinicians read trainings" on public.trainings
for select to authenticated using (true);
drop policy if exists "engineers manage trainings" on public.trainings;
create policy "engineers manage trainings" on public.trainings
for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'tecnico' and active)
  or public.is_manager()
) with check (instructor_id = auth.uid() or public.is_manager());
drop policy if exists "participants read training links" on public.training_participants;
create policy "participants read training links" on public.training_participants
for select to authenticated using (participant_id = auth.uid() or public.is_manager());
drop policy if exists "engineers manage training links" on public.training_participants;
create policy "engineers manage training links" on public.training_participants
for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'tecnico' and active)
  or public.is_manager()
) with check (true);

drop policy if exists "managers read quotes" on public.quotes;
create policy "managers read quotes" on public.quotes
for select to authenticated using (public.is_manager());
drop policy if exists "managers manage quotes" on public.quotes;
create policy "managers manage quotes" on public.quotes
for all to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists "managers read audit log" on public.audit_log;
create policy "managers read audit log" on public.audit_log
for select to authenticated using (public.is_manager());

drop policy if exists "managers manage access requests" on public.user_access_requests;
create policy "managers manage access requests" on public.user_access_requests
for all to authenticated using (public.is_manager()) with check (public.is_manager() and requested_by = auth.uid());
