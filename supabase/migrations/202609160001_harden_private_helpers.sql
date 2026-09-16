-- Keep privileged helpers out of the exposed public schema. RLS helper calls
-- retain authenticated execution, but cannot be reached as Data API RPCs.
create schema if not exists private;

alter function public.handle_new_user() set schema private;
alter function public.add_team_creator_as_owner() set schema private;
alter function public.is_team_member(uuid) set schema private;
alter function public.can_manage_team(uuid) set schema private;
alter function public.can_edit_service(uuid) set schema private;
alter function public.set_updated_at() set search_path = public;
alter function public.set_updated_at() set schema private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.add_team_creator_as_owner() from public, anon, authenticated;
revoke all on function private.is_team_member(uuid) from public, anon;
revoke all on function private.can_manage_team(uuid) from public, anon;
revoke all on function private.can_edit_service(uuid) from public, anon;
grant execute on function private.is_team_member(uuid) to authenticated;
grant execute on function private.can_manage_team(uuid) to authenticated;
grant execute on function private.can_edit_service(uuid) to authenticated;
