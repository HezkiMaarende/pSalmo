alter table public.teams add column admin_managed boolean not null default false;
alter table public.team_memberships add column song_editor boolean not null default false;
alter table public.services add column service_day date generated always as ((service_date at time zone 'Asia/Jakarta')::date) stored;
create unique index services_team_day_type_unique on public.services(team_id, service_day, service_type);

create table public.roster_people (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  account_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(team_id, account_id)
);
alter table public.service_assignments add column person_id uuid references public.roster_people(id) on delete restrict;
create index assignments_person_idx on public.service_assignments(person_id);
create table public.weekly_schedules (
  team_id uuid not null references public.teams(id) on delete cascade,
  sunday date not null check (extract(dow from sunday) = 0),
  published_at timestamptz,
  primary key(team_id, sunday)
);
alter table public.songs add column lyrics text not null default '';
create table public.song_references (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  url text not null check (url ~ '^https://(www\.)?(youtube\.com/|youtu\.be/)'),
  position integer not null check (position >= 0),
  unique(song_id, position)
);
insert into public.song_references(song_id,label,url,position)
select id,'Referensi',youtube_url,0 from public.songs
where youtube_url ~ '^https://(www\.)?(youtube\.com/|youtu\.be/)';

create or replace function private.is_assigned_service(target_service_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.services s
    join public.team_memberships m on m.team_id=s.team_id and m.user_id=auth.uid()
    join public.service_assignments a on a.service_id=s.id
    left join public.roster_people p on p.id=a.person_id and p.team_id=s.team_id
    join public.teams t on t.id=s.team_id
    where s.id=target_service_id and ((p.account_id=auth.uid() and p.active)
      or (not t.admin_managed and a.person_id is null and a.user_id=auth.uid()))
  );
$$;
create or replace function private.can_edit_service(target_service_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.services s join public.team_memberships m on m.team_id=s.team_id and m.user_id=auth.uid()
    where s.id=target_service_id and (m.role in ('owner','admin') or (m.song_editor and exists (
      select 1 from public.service_assignments a
      left join public.roster_people p on p.id=a.person_id and p.team_id=s.team_id
      join public.teams t on t.id=s.team_id
      where a.service_id=s.id and lower(trim(a.role_name)) in ('wl','md')
      and ((p.account_id=auth.uid() and p.active) or (not t.admin_managed and a.person_id is null and a.user_id=auth.uid()))
    )))
  );
$$;
create or replace function private.can_view_service(target_service_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.can_edit_service(target_service_id) or exists (
    select 1 from public.services s where s.id=target_service_id and s.status='approved'
    and private.is_assigned_service(s.id)
  );
$$;
create or replace function private.can_manage_library(target_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.team_memberships m where m.team_id=target_team_id and m.user_id=auth.uid()
    and (m.role in ('owner','admin') or m.song_editor));
$$;
revoke all on function private.is_assigned_service(uuid), private.can_manage_library(uuid) from public, anon;
grant execute on function private.is_assigned_service(uuid), private.can_manage_library(uuid) to authenticated;

alter table public.roster_people enable row level security;
alter table public.weekly_schedules enable row level security;
alter table public.song_references enable row level security;
revoke all on public.roster_people,public.weekly_schedules,public.song_references from anon;
grant select,insert,update,delete on public.roster_people,public.weekly_schedules,public.song_references to authenticated;
create policy "PIC reads people" on public.roster_people for select to authenticated using(private.can_manage_team(team_id));
create policy "PIC adds names" on public.roster_people for insert to authenticated
with check(private.can_manage_team(team_id) and account_id is null);
-- Account links and activation changes are guarded RPC-only.
revoke update,delete on public.roster_people from authenticated;
create policy "PIC manages schedule" on public.weekly_schedules for all to authenticated
using(private.can_manage_team(team_id)) with check(private.can_manage_team(team_id));
create policy "members read references" on public.song_references for select to authenticated
using(exists(select 1 from public.songs s where s.id=song_id and private.is_team_member(s.team_id)));
create policy "editors manage references" on public.song_references for all to authenticated
using(exists(select 1 from public.songs s where s.id=song_id and private.can_manage_library(s.team_id)))
with check(exists(select 1 from public.songs s where s.id=song_id and private.can_manage_library(s.team_id)));
drop policy "songs managed by admins" on public.songs;
create policy "editors manage songs" on public.songs for all to authenticated
using(private.can_manage_library(team_id)) with check(private.can_manage_library(team_id));
drop policy "click config visible to service team" on public.click_device_configurations;
create policy "click config visible to assigned users" on public.click_device_configurations for select to authenticated
using(private.can_view_service(service_id));

create or replace function private.validate_assignment_person()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is not null and not exists(
    select 1 from public.roster_people p join public.services s on s.team_id=p.team_id
    where p.id=new.person_id and s.id=new.service_id and p.active
  ) then raise exception 'Petugas tidak aktif atau berasal dari gereja lain.'; end if;
  if exists(select 1 from public.services s join public.teams t on t.id=s.team_id
    where s.id=new.service_id and t.admin_managed) then
    new.user_id := null;
  end if;
  if new.person_id is not null and new.display_name is null then
    select name into new.display_name from public.roster_people where id=new.person_id;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_assignment_person() from public,anon,authenticated;
create trigger validate_assignment_person before insert or update on public.service_assignments
for each row execute function private.validate_assignment_person();

create or replace function public.link_roster_account(target_person_id uuid, registered_email text)
returns void language plpgsql security definer set search_path = public as $$
declare person public.roster_people%rowtype; account uuid;
begin
  select * into person from public.roster_people where id=target_person_id for update;
  if not found or not private.can_manage_team(person.team_id) then raise exception 'Hanya PIC dapat menghubungkan akun.'; end if;
  select id into account from auth.users where lower(email)=lower(trim(registered_email));
  if account is null then raise exception 'Akun belum terdaftar. Minta petugas membuat akun terlebih dahulu.'; end if;
  if person.account_id is not null and person.account_id<>account then raise exception 'Petugas sudah terhubung. Keluarkan akun lama terlebih dahulu.'; end if;
  update public.roster_people set account_id=account,active=true where id=person.id;
  insert into public.team_memberships(team_id,user_id,role) values(person.team_id,account,'member') on conflict do nothing;
end;
$$;
create or replace function public.kick_roster_person(target_person_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare person public.roster_people%rowtype;
begin
  select * into person from public.roster_people where id=target_person_id for update;
  if not found or not private.can_manage_team(person.team_id) then raise exception 'Hanya PIC dapat mengeluarkan petugas.'; end if;
  if person.account_id is not null then
    perform public.remove_team_member(person.team_id,person.account_id);
  end if;
  update public.roster_people set active=false,account_id=null where id=person.id;
end;
$$;
create or replace function public.set_song_editor(target_team_id uuid,target_user_id uuid,enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.can_manage_team(target_team_id) then raise exception 'Hanya PIC dapat mengatur editor lagu.'; end if;
  update public.team_memberships set song_editor=enabled where team_id=target_team_id and user_id=target_user_id;
  if not found then raise exception 'Anggota tidak ditemukan.'; end if;
end;
$$;

-- Roster-only projection, intentionally readable by unassigned church members.
-- No notes, setlists, media, or account identifiers cross this boundary.
create or replace function public.read_weekly_schedule(target_team_id uuid,date_from date,date_to date)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_team_member(target_team_id) then raise exception 'Anda bukan anggota gereja ini.'; end if;
  if date_to<date_from or date_to-date_from>366 then raise exception 'Rentang jadwal tidak valid.'; end if;
  return query select jsonb_build_object('sunday',w.sunday,'published_at',w.published_at,'services',
    coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'service_type',s.service_type,'status',s.status,
      'assigned',private.is_assigned_service(s.id),'can_open',private.can_view_service(s.id),'can_edit',private.can_edit_service(s.id),
      'roster',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'role_name',a.role_name,'display_name',coalesce(a.display_name,p.name,'Petugas')) order by a.position,a.id)
        from public.service_assignments a left join public.roster_people p on p.id=a.person_id where a.service_id=s.id),'[]'::jsonb)) order by s.service_type)
      from public.services s where s.team_id=w.team_id and s.service_day=w.sunday),'[]'::jsonb))
    from public.weekly_schedules w where w.team_id=target_team_id and w.sunday between date_from and date_to
      and (w.published_at is not null or private.can_manage_team(w.team_id)) order by w.sunday;
end;
$$;

-- Block invitation write/accept paths only for admin-managed churches.
alter function public.create_team_invite(uuid, public.membership_role, integer) rename to legacy_create_team_invite;
alter function public.accept_team_invite(text) rename to legacy_accept_team_invite;
alter function public.legacy_create_team_invite(uuid, public.membership_role, integer) set schema private;
alter function public.legacy_accept_team_invite(text) set schema private;
revoke all on function private.legacy_create_team_invite(uuid,public.membership_role,integer),private.legacy_accept_team_invite(text) from public,anon,authenticated;
create or replace function public.create_team_invite(target_team_id uuid,target_role public.membership_role default 'member',valid_for_hours integer default 168)
returns table(invite_id uuid,token text,role public.membership_role,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.teams where id=target_team_id and admin_managed) then raise exception 'Anggota ditambahkan langsung oleh PIC.'; end if;
  return query select * from private.legacy_create_team_invite(target_team_id,target_role,valid_for_hours);
end;
$$;
create or replace function public.accept_team_invite(invite_token text)
returns table(team_id uuid,team_name text,role public.membership_role)
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.invites i join public.teams t on t.id=i.team_id
    where i.token_hash=encode(digest(trim(invite_token),'sha256'),'hex') and t.admin_managed) then raise exception 'Anggota ditambahkan langsung oleh PIC.'; end if;
  return query select * from private.legacy_accept_team_invite(invite_token);
end;
$$;
drop policy "invites managed by admins" on public.invites;
create policy "prototype invites only" on public.invites for all to authenticated
using(private.can_manage_team(team_id) and exists(select 1 from public.teams t where t.id=team_id and not t.admin_managed))
with check(private.can_manage_team(team_id) and exists(select 1 from public.teams t where t.id=team_id and not t.admin_managed));

drop function public.move_setlist_item(uuid,text);
create function public.move_setlist_item(item_id uuid,move_direction text,expected_revision integer)
returns integer language plpgsql security invoker set search_path=public as $$
declare current_item public.setlist_items%rowtype; neighbour public.setlist_items%rowtype; revision_now integer; temp_position integer;
begin
  if move_direction not in ('up','down') then raise exception 'Arah tidak valid.'; end if;
  select * into current_item from public.setlist_items where id=item_id;
  if not found then raise exception 'Lagu tidak dapat diakses.'; end if;
  select l.revision into revision_now from public.setlists l where l.id=current_item.setlist_id
    and private.can_edit_service(l.service_id) for update;
  if not found then raise exception 'Setlist tidak dapat diedit.'; end if;
  if revision_now<>expected_revision then raise exception 'Setlist telah berubah. Muat ulang dan coba lagi.' using errcode='40001'; end if;
  select * into current_item from public.setlist_items where id=item_id for update;
  select * into neighbour from public.setlist_items i where i.setlist_id=current_item.setlist_id
    and ((move_direction='up' and i.position<current_item.position) or (move_direction='down' and i.position>current_item.position))
    order by case when move_direction='up' then i.position end desc nulls last,
      case when move_direction='down' then i.position end asc nulls last limit 1 for update;
  if not found then return revision_now; end if;
  select coalesce(min(position),0)-1 into temp_position from public.setlist_items where setlist_id=current_item.setlist_id;
  update public.setlist_items set position=temp_position where id=current_item.id;
  update public.setlist_items set position=current_item.position where id=neighbour.id;
  update public.setlist_items set position=neighbour.position where id=current_item.id;
  select revision into revision_now from public.setlists where id=current_item.setlist_id;
  return revision_now;
end;
$$;

revoke all on function public.link_roster_account(uuid,text),public.kick_roster_person(uuid),public.set_song_editor(uuid,uuid,boolean),
public.read_weekly_schedule(uuid,date,date),public.create_team_invite(uuid,public.membership_role,integer),public.accept_team_invite(text),public.move_setlist_item(uuid,text,integer) from public,anon;
grant execute on function public.link_roster_account(uuid,text),public.kick_roster_person(uuid),public.set_song_editor(uuid,uuid,boolean),
public.read_weekly_schedule(uuid,date,date),public.create_team_invite(uuid,public.membership_role,integer),public.accept_team_invite(text),public.move_setlist_item(uuid,text,integer) to authenticated;

create function private.track_setlist_mutation()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_op='DELETE' then
    update public.setlists set revision=revision+1 where id=old.setlist_id;
    return old;
  end if;
  update public.setlists set revision=revision+1 where id=new.setlist_id;
  if tg_op='UPDATE' and old.setlist_id<>new.setlist_id then
    update public.setlists set revision=revision+1 where id=old.setlist_id;
  end if;
  return new;
end;
$$;
revoke all on function private.track_setlist_mutation() from public,anon,authenticated;
create trigger track_setlist_mutation after insert or update or delete on public.setlist_items
for each row execute function private.track_setlist_mutation();

create function private.validate_setlist_links()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.song_id is not null and not exists(select 1 from public.songs s
    join public.services v on v.team_id=s.team_id join public.setlists l on l.service_id=v.id
    where l.id=new.setlist_id and s.id=new.song_id) then raise exception 'Lagu berasal dari gereja lain.'; end if;
  if new.medley_group_id is not null and not exists(select 1 from public.medley_groups g
    where g.id=new.medley_group_id and g.setlist_id=new.setlist_id) then raise exception 'Medley berasal dari setlist lain.'; end if;
  return new;
end;
$$;
revoke all on function private.validate_setlist_links() from public,anon,authenticated;
create trigger validate_setlist_links before insert or update on public.setlist_items
for each row execute function private.validate_setlist_links();

create function public.save_library_song(target_team_id uuid,target_song_id uuid,song_data jsonb,references_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved_id uuid; reference jsonb; reference_position integer := 0;
begin
  if not private.can_manage_library(target_team_id) then raise exception 'Anda tidak memiliki akses editor lagu.'; end if;
  if coalesce(trim(song_data->>'title'),'')='' then raise exception 'Judul lagu wajib diisi.'; end if;
  if jsonb_typeof(references_data)<>'array' then raise exception 'Referensi harus berupa daftar.'; end if;
  if target_song_id is null then
    insert into public.songs(team_id,title,artist,default_key,default_bpm,default_time_signature,lyrics,writer_credits,copyright_notice,created_by)
    values(target_team_id,trim(song_data->>'title'),nullif(trim(song_data->>'artist'),''),nullif(trim(song_data->>'key'),''),
      nullif(song_data->>'bpm','')::integer,nullif(song_data->>'time_signature',''),coalesce(song_data->>'lyrics',''),
      nullif(song_data->>'writer_credits',''),nullif(song_data->>'copyright_notice',''),auth.uid()) returning id into saved_id;
  else
    update public.songs set title=trim(song_data->>'title'),artist=nullif(trim(song_data->>'artist'),''),
      default_key=nullif(trim(song_data->>'key'),''),default_bpm=nullif(song_data->>'bpm','')::integer,
      default_time_signature=nullif(song_data->>'time_signature',''),lyrics=coalesce(song_data->>'lyrics',''),
      writer_credits=nullif(song_data->>'writer_credits',''),copyright_notice=nullif(song_data->>'copyright_notice','')
      where id=target_song_id and team_id=target_team_id returning id into saved_id;
    if saved_id is null then raise exception 'Lagu tidak ditemukan.'; end if;
  end if;
  delete from public.song_references where song_id=saved_id;
  for reference in select value from jsonb_array_elements(references_data) loop
    insert into public.song_references(song_id,label,url,position)
      values(saved_id,trim(reference->>'label'),trim(reference->>'url'),reference_position);
    reference_position := reference_position+1;
  end loop;
  return saved_id;
end;
$$;
revoke all on function public.save_library_song(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_library_song(uuid,uuid,jsonb,jsonb) to authenticated;
