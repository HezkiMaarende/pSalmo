-- A temporary WL/MD service assignment grants setlist editing, but PIC/admin
-- alone manages the roster and temporary service roles.
drop policy if exists "assignments managed by admins" on public.service_assignments;

create policy "assignments managed by team admins" on public.service_assignments
for all to authenticated
using (exists (
  select 1 from public.services s
  where s.id = service_id and private.can_manage_team(s.team_id)
))
with check (exists (
  select 1 from public.services s
  where s.id = service_id and private.can_manage_team(s.team_id)
));
