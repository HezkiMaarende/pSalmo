-- Fail closed for callers without a membership (SQL NULL must not bypass IF).
do $$ declare definition text; signature text; begin
  foreach signature in array array['public.set_team_member_role(uuid,uuid,public.membership_role)','public.remove_team_member(uuid,uuid)'] loop
    select pg_get_functiondef(signature::regprocedure) into definition;
    definition := replace(definition, 'if caller_role not in', 'if caller_role is null or caller_role not in');
    execute definition;
  end loop;
end $$;
create or replace function public.service_edit_permission(target_service_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.can_edit_service(target_service_id);
$$;
revoke all on function public.service_edit_permission(uuid) from public, anon;
grant execute on function public.service_edit_permission(uuid) to authenticated;
