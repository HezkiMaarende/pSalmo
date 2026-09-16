-- Access and publication rules from the V1 Scope Amendment.
-- Admins own team membership, invitations, roster, notes, media, and service
-- publication. A temporary WL/MD assignment grants setlist-only editing.

create or replace function private.can_view_service(target_service_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.can_edit_service(target_service_id)
  or exists (
    select 1
    from public.services s
    join public.team_memberships m on m.team_id = s.team_id
    where s.id = target_service_id
      and s.status = 'approved'
      and m.user_id = auth.uid()
  );
$$;

revoke all on function private.can_view_service(uuid) from public, anon;
grant execute on function private.can_view_service(uuid) to authenticated;

drop policy if exists "services visible to team" on public.services;
create policy "services visible when published or editable" on public.services
for select to authenticated using (private.can_view_service(id));

-- Membership writes go through the guarded RPCs below. The old generic admin
-- policy allowed an admin to promote itself to owner or remove the owner.
alter function private.add_team_creator_as_owner() security definer set search_path = public;
drop policy if exists "memberships managed by admins" on public.team_memberships;
create policy "memberships cannot be changed directly" on public.team_memberships
for all to authenticated using (false) with check (false);

drop policy if exists "assignments visible to service team" on public.service_assignments;
create policy "assignments visible when service is visible" on public.service_assignments
for select to authenticated using (private.can_view_service(service_id));

drop policy if exists "notes visible to service team" on public.service_notes;
create policy "notes visible when service is visible" on public.service_notes
for select to authenticated using (private.can_view_service(service_id));

drop policy if exists "setlists visible to service team" on public.setlists;
create policy "setlists visible when service is visible" on public.setlists
for select to authenticated using (private.can_view_service(service_id));

drop policy if exists "medleys visible to setlist team" on public.medley_groups;
create policy "medleys visible when service is visible" on public.medley_groups
for select to authenticated using (exists (
  select 1 from public.setlists l where l.id = setlist_id and private.can_view_service(l.service_id)
));

drop policy if exists "items visible to setlist team" on public.setlist_items;
create policy "items visible when service is visible" on public.setlist_items
for select to authenticated using (exists (
  select 1 from public.setlists l where l.id = setlist_id and private.can_view_service(l.service_id)
));

drop policy if exists "media visible to service team" on public.media_references;
create policy "media visible when service is visible" on public.media_references
for select to authenticated using (private.can_view_service(service_id));

-- Service-wide content is administered by PIC/admin. WL/MD remains able to
-- mutate setlist rows through can_edit_service, but not notes or media.
drop policy if exists "notes managed by admins" on public.service_notes;
create policy "notes managed by team admins" on public.service_notes
for all to authenticated
using (exists (select 1 from public.services s where s.id = service_id and private.can_manage_team(s.team_id)))
with check (exists (select 1 from public.services s where s.id = service_id and private.can_manage_team(s.team_id)));

drop policy if exists "media managed by admins" on public.media_references;
create policy "media managed by team admins" on public.media_references
for all to authenticated
using (exists (select 1 from public.services s where s.id = service_id and private.can_manage_team(s.team_id)))
with check (exists (select 1 from public.services s where s.id = service_id and private.can_manage_team(s.team_id)));

-- Raw invite tokens are returned exactly once and only their SHA-256 digest is
-- retained. Acceptance locks the invitation row so a token cannot be consumed
-- twice under concurrent requests.
create or replace function public.create_team_invite(
  target_team_id uuid,
  target_role public.membership_role default 'member',
  valid_for_hours integer default 168
)
returns table (invite_id uuid, token text, role public.membership_role, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  raw_token text;
  invite_expiry timestamptz;
begin
  if auth.uid() is null or not private.can_manage_team(target_team_id) then
    raise exception 'Only team admins can create invitations.';
  end if;
  if target_role = 'owner' then
    raise exception 'An invitation cannot grant owner access.';
  end if;
  if valid_for_hours not between 1 and 24 * 30 then
    raise exception 'Invitation expiry must be between 1 hour and 30 days.';
  end if;

  raw_token := encode(gen_random_bytes(24), 'hex');
  invite_expiry := now() + make_interval(hours => valid_for_hours);
  insert into public.invites (team_id, token_hash, role, expires_at, created_by)
  values (target_team_id, encode(digest(raw_token, 'sha256'), 'hex'), target_role, invite_expiry, auth.uid())
  returning id into invite_id;

  token := raw_token;
  role := target_role;
  expires_at := invite_expiry;
  return next;
end;
$$;

create or replace function public.accept_team_invite(invite_token text)
returns table (team_id uuid, team_name text, role public.membership_role)
language plpgsql security definer set search_path = public as $$
declare
  invitation public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in before accepting an invitation.';
  end if;
  select * into invitation
  from public.invites
  where token_hash = encode(digest(trim(invite_token), 'sha256'), 'hex')
  for update;

  if not found or invitation.revoked_at is not null or invitation.used_at is not null or invitation.expires_at <= now() then
    raise exception 'This invitation is invalid, expired, revoked, or already used.';
  end if;
  if exists (select 1 from public.team_memberships where team_id = invitation.team_id and user_id = auth.uid()) then
    raise exception 'You already belong to this team.';
  end if;

  insert into public.team_memberships (team_id, user_id, role)
  values (invitation.team_id, auth.uid(), invitation.role);
  update public.invites set used_at = now() where id = invitation.id;

  return query
  select t.id, t.name, invitation.role from public.teams t where t.id = invitation.team_id;
end;
$$;

create or replace function public.set_team_member_role(
  target_team_id uuid,
  target_user_id uuid,
  new_role public.membership_role
)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_role public.membership_role;
  target_role public.membership_role;
begin
  select role into caller_role from public.team_memberships where team_id = target_team_id and user_id = auth.uid();
  select role into target_role from public.team_memberships where team_id = target_team_id and user_id = target_user_id for update;
  if caller_role not in ('owner', 'admin') then raise exception 'Only team admins can manage membership.'; end if;
  if target_role is null then raise exception 'Team member not found.'; end if;
  if target_role = 'owner' or new_role = 'owner' then raise exception 'Owner access cannot be changed here.'; end if;
  if caller_role = 'admin' and target_role = 'admin' then raise exception 'Only the owner can change an admin role.'; end if;
  update public.team_memberships set role = new_role where team_id = target_team_id and user_id = target_user_id;
end;
$$;

create or replace function public.remove_team_member(target_team_id uuid, target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_role public.membership_role;
  target_role public.membership_role;
begin
  select role into caller_role from public.team_memberships where team_id = target_team_id and user_id = auth.uid();
  select role into target_role from public.team_memberships where team_id = target_team_id and user_id = target_user_id for update;
  if caller_role not in ('owner', 'admin') then raise exception 'Only team admins can manage membership.'; end if;
  if target_role is null then raise exception 'Team member not found.'; end if;
  if target_role = 'owner' then raise exception 'Owner access cannot be removed here.'; end if;
  if caller_role = 'admin' and target_role = 'admin' then raise exception 'Only the owner can remove an admin.'; end if;
  delete from public.team_memberships where team_id = target_team_id and user_id = target_user_id;
end;
$$;

create or replace function public.revoke_team_invite(target_invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  invite_team_id uuid;
begin
  select team_id into invite_team_id from public.invites where id = target_invite_id for update;
  if invite_team_id is null or not private.can_manage_team(invite_team_id) then
    raise exception 'Only team admins can revoke this invitation.';
  end if;
  update public.invites set revoked_at = now()
  where id = target_invite_id and used_at is null and revoked_at is null;
end;
$$;

revoke all on function public.create_team_invite(uuid, public.membership_role, integer) from public, anon;
revoke all on function public.accept_team_invite(text) from public, anon;
revoke all on function public.set_team_member_role(uuid, uuid, public.membership_role) from public, anon;
revoke all on function public.remove_team_member(uuid, uuid) from public, anon;
revoke all on function public.revoke_team_invite(uuid) from public, anon;
grant execute on function public.create_team_invite(uuid, public.membership_role, integer) to authenticated;
grant execute on function public.accept_team_invite(text) to authenticated;
grant execute on function public.set_team_member_role(uuid, uuid, public.membership_role) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.revoke_team_invite(uuid) to authenticated;
