-- INSERT ... RETURNING is still subject to the new row's SELECT policy inside
-- an invoker function. Generate the ID first, insert without RETURNING, then
-- read the row after the owner-membership after-trigger has completed.
create or replace function public.create_team(team_name text)
returns public.teams
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_team public.teams%rowtype;
  created_team_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(team_name, ''))) = 0 then
    raise exception 'A team name is required';
  end if;

  insert into public.teams (id, name, created_by)
  values (created_team_id, trim(team_name), auth.uid());

  select * into created_team from public.teams where id = created_team_id;
  return created_team;
end;
$$;

revoke execute on function public.create_team(text) from public;
grant execute on function public.create_team(text) to authenticated;
