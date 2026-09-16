-- Preserve the prototype acceptance path without ambiguous OUT-column names.
create or replace function private.legacy_accept_team_invite(invite_token text)
returns table(team_id uuid,team_name text,role public.membership_role)
language plpgsql security definer set search_path=public as $$
declare invitation public.invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in before accepting an invitation.'; end if;
  select i.* into invitation from public.invites i
    where i.token_hash=encode(digest(trim(invite_token),'sha256'),'hex') for update;
  if not found or invitation.revoked_at is not null or invitation.used_at is not null or invitation.expires_at<=now() then
    raise exception 'This invitation is invalid, expired, revoked, or already used.';
  end if;
  if exists(select 1 from public.team_memberships m where m.team_id=invitation.team_id and m.user_id=auth.uid()) then
    raise exception 'You already belong to this team.';
  end if;
  insert into public.team_memberships(team_id,user_id,role) values(invitation.team_id,auth.uid(),invitation.role);
  update public.invites i set used_at=now() where i.id=invitation.id;
  return query select t.id,t.name,invitation.role from public.teams t where t.id=invitation.team_id;
end $$;
revoke all on function private.legacy_accept_team_invite(text) from public,anon,authenticated;
