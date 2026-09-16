-- pSalmo V1 foundation. The 15 September scope amendment is authoritative.
create extension if not exists pgcrypto;

create type public.membership_role as enum ('owner', 'admin', 'member');
create type public.service_status as enum ('draft', 'approved', 'archived', 'cancelled');
create type public.service_type as enum ('ir_1_2', 'ir_3');
create type public.smart_add_status as enum ('pending', 'extracted', 'committed', 'failed', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_memberships (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token_hash text not null unique,
  role public.membership_role not null default 'member',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 150),
  service_type public.service_type not null,
  service_date timestamptz not null,
  status public.service_status not null default 'draft',
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_assignments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  role_name text not null check (char_length(trim(role_name)) between 1 and 80),
  display_name text,
  position integer not null default 0,
  unique (service_id, role_name, user_id)
);

create table public.service_notes (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  body text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  artist text,
  writer_credits text,
  copyright_notice text,
  default_key text,
  default_bpm integer check (default_bpm between 20 and 400),
  default_time_signature text check (default_time_signature ~ '^([1-9][0-9]*)/([1-9][0-9]*)$'),
  youtube_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (team_id, title, artist)
);

create table public.setlists (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null unique references public.services(id) on delete cascade,
  title text not null,
  thumbnail text check (char_length(thumbnail) <= 16),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medley_groups (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  position integer not null,
  label text,
  unique (setlist_id, position)
);

create table public.setlist_items (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  song_id uuid references public.songs(id) on delete set null,
  proposed_title text,
  artist text,
  position integer not null,
  key text,
  bpm integer check (bpm between 20 and 400),
  time_signature text check (time_signature is null or time_signature ~ '^([1-9][0-9]*)/([1-9][0-9]*)$'),
  structure jsonb not null default '[]'::jsonb check (jsonb_typeof(structure) = 'array'),
  lyrics_or_chords text,
  arrangement_url text,
  notes text,
  medley_group_id uuid references public.medley_groups(id) on delete set null,
  check (song_id is not null or proposed_title is not null),
  unique (setlist_id, position)
);

create table public.media_references (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  label text not null,
  url text not null,
  position integer not null default 0
);

create table public.click_device_configurations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null unique references public.services(id) on delete cascade,
  output_route text,
  keep_awake boolean not null default true,
  background_enabled boolean not null default true,
  notes text
);

create table public.smart_add_jobs (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  encrypted_raw_input bytea not null,
  parsed_result jsonb,
  status public.smart_add_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '30 days'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index services_team_date_idx on public.services(team_id, service_date desc);
create index memberships_user_team_idx on public.team_memberships(user_id, team_id);
create index songs_team_title_idx on public.songs(team_id, title);
create index setlist_items_order_idx on public.setlist_items(setlist_id, position);
create index smart_add_jobs_expiry_idx on public.smart_add_jobs(expires_at);

-- Auth creates the profile before any client code can create a team. A separate
-- trigger makes that creator the team's owner, avoiding a client-side privilege gap.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;
create trigger auth_user_profile_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.add_team_creator_as_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.team_memberships (team_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
create trigger team_creator_is_owner
  after insert on public.teams for each row execute procedure public.add_team_creator_as_owner();

create or replace function public.is_team_member(target_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_memberships m where m.team_id = target_team_id and m.user_id = auth.uid());
$$;

create or replace function public.can_manage_team(target_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_memberships m where m.team_id = target_team_id and m.user_id = auth.uid() and m.role in ('owner', 'admin'));
$$;

create or replace function public.can_edit_service(target_service_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.services s join public.team_memberships m on m.team_id = s.team_id
    where s.id = target_service_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  ) or exists (
    select 1 from public.service_assignments a
    where a.service_id = target_service_id and a.user_id = auth.uid() and lower(a.role_name) in ('wl', 'md')
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger services_updated_at before update on public.services for each row execute procedure public.set_updated_at();
create trigger notes_updated_at before update on public.service_notes for each row execute procedure public.set_updated_at();
create trigger setlists_updated_at before update on public.setlists for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.invites enable row level security;
alter table public.services enable row level security;
alter table public.service_assignments enable row level security;
alter table public.service_notes enable row level security;
alter table public.songs enable row level security;
alter table public.setlists enable row level security;
alter table public.medley_groups enable row level security;
alter table public.setlist_items enable row level security;
alter table public.media_references enable row level security;
alter table public.click_device_configurations enable row level security;
alter table public.smart_add_jobs enable row level security;

-- Do not rely on dashboard default privileges: grants decide whether the Data API
-- can reach a table; RLS then decides which rows are reachable.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- These helpers intentionally bypass membership-table RLS to avoid recursive
-- policies. They are not public RPC endpoints.
revoke execute on function public.is_team_member(uuid) from public;
revoke execute on function public.can_manage_team(uuid) from public;
revoke execute on function public.can_edit_service(uuid) from public;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.can_manage_team(uuid) to authenticated;
grant execute on function public.can_edit_service(uuid) to authenticated;

create policy "profiles readable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "teams visible to members" on public.teams for select to authenticated using (public.is_team_member(id));
create policy "teams created by creator" on public.teams for insert to authenticated with check (created_by = auth.uid());
create policy "teams managed by admins" on public.teams for update to authenticated using (public.can_manage_team(id)) with check (public.can_manage_team(id));
create policy "memberships visible to team" on public.team_memberships for select to authenticated using (public.is_team_member(team_id));
create policy "memberships managed by admins" on public.team_memberships for all to authenticated using (public.can_manage_team(team_id)) with check (public.can_manage_team(team_id));
create policy "invites managed by admins" on public.invites for all to authenticated using (public.can_manage_team(team_id)) with check (public.can_manage_team(team_id));

create policy "services visible to team" on public.services for select to authenticated using (public.is_team_member(team_id));
create policy "services managed by admins" on public.services for all to authenticated using (public.can_manage_team(team_id)) with check (public.can_manage_team(team_id));
create policy "assignments visible to service team" on public.service_assignments for select to authenticated using (public.can_edit_service(service_id) or exists (select 1 from public.services s where s.id = service_id and public.is_team_member(s.team_id)));
create policy "assignments managed by admins" on public.service_assignments for all to authenticated using (public.can_edit_service(service_id)) with check (public.can_edit_service(service_id));
create policy "notes visible to service team" on public.service_notes for select to authenticated using (exists (select 1 from public.services s where s.id = service_id and public.is_team_member(s.team_id)));
create policy "notes managed by admins" on public.service_notes for all to authenticated using (public.can_edit_service(service_id)) with check (public.can_edit_service(service_id));
create policy "songs visible to team" on public.songs for select to authenticated using (public.is_team_member(team_id));
create policy "songs managed by admins" on public.songs for all to authenticated using (public.can_manage_team(team_id)) with check (public.can_manage_team(team_id));
create policy "setlists visible to service team" on public.setlists for select to authenticated using (exists (select 1 from public.services s where s.id = service_id and public.is_team_member(s.team_id)));
create policy "setlists managed by admins" on public.setlists for all to authenticated using (public.can_edit_service(service_id)) with check (public.can_edit_service(service_id));
create policy "medleys visible to setlist team" on public.medley_groups for select to authenticated using (exists (select 1 from public.setlists l join public.services s on s.id = l.service_id where l.id = setlist_id and public.is_team_member(s.team_id)));
create policy "medleys managed by admins" on public.medley_groups for all to authenticated using (exists (select 1 from public.setlists l where l.id = setlist_id and public.can_edit_service(l.service_id))) with check (exists (select 1 from public.setlists l where l.id = setlist_id and public.can_edit_service(l.service_id)));
create policy "items visible to setlist team" on public.setlist_items for select to authenticated using (exists (select 1 from public.setlists l join public.services s on s.id = l.service_id where l.id = setlist_id and public.is_team_member(s.team_id)));
create policy "items managed by admins" on public.setlist_items for all to authenticated using (exists (select 1 from public.setlists l where l.id = setlist_id and public.can_edit_service(l.service_id))) with check (exists (select 1 from public.setlists l where l.id = setlist_id and public.can_edit_service(l.service_id)));
create policy "media visible to service team" on public.media_references for select to authenticated using (exists (select 1 from public.services s where s.id = service_id and public.is_team_member(s.team_id)));
create policy "media managed by admins" on public.media_references for all to authenticated using (public.can_edit_service(service_id)) with check (public.can_edit_service(service_id));
create policy "click config visible to service team" on public.click_device_configurations for select to authenticated using (exists (select 1 from public.services s where s.id = service_id and public.is_team_member(s.team_id)));
create policy "click config managed by admins" on public.click_device_configurations for all to authenticated using (public.can_edit_service(service_id)) with check (public.can_edit_service(service_id));
-- Jobs are private to their creator; Edge Functions use service-role credentials to process them.
create policy "smart add jobs visible to creator" on public.smart_add_jobs for select to authenticated using (created_by = auth.uid());
create policy "smart add jobs created by caller" on public.smart_add_jobs for insert to authenticated with check (created_by = auth.uid() and public.can_edit_service(service_id));
