-- Return a newly created team only after team_creator_is_owner has added the
-- caller's owner membership. A direct PostgREST INSERT ... RETURNING checks
-- the SELECT policy before that after-insert trigger is visible to RETURNING.
create or replace function public.create_team(team_name text)
returns public.teams
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_team public.teams%rowtype;
begin
  if char_length(trim(coalesce(team_name, ''))) = 0 then
    raise exception 'A team name is required';
  end if;

  insert into public.teams (name, created_by)
  values (trim(team_name), auth.uid())
  returning * into created_team;

  return created_team;
end;
$$;

revoke execute on function public.create_team(text) from public;
grant execute on function public.create_team(text) to authenticated;
