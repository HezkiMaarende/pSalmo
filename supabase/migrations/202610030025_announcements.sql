create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  external_url text check (
    external_url is null or external_url ~ '^https://[^[:space:]]+$'
  ),
  pinned boolean not null default false,
  expires_on date,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (published_at is null or archived_at is null)
);

create index announcements_team_feed_idx
  on public.announcements(team_id, pinned desc, published_at desc)
  where published_at is not null and archived_at is null;

create trigger announcements_updated_at
before update on public.announcements
for each row execute function private.set_updated_at();

alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to authenticated;
grant insert (
  team_id, title, body, external_url, pinned, expires_on, created_by, updated_by
) on public.announcements to authenticated;
grant update (
  title, body, external_url, pinned, expires_on, updated_by
) on public.announcements to authenticated;

create policy "members read active announcements"
on public.announcements for select to authenticated
using (
  private.can_manage_team(team_id)
  or (
    private.is_team_member(team_id)
    and published_at is not null
    and archived_at is null
    and (
      expires_on is null
      or expires_on >= (now() at time zone 'Asia/Jakarta')::date
    )
  )
);

create policy "PIC creates announcement drafts"
on public.announcements for insert to authenticated
with check (
  private.can_manage_team(team_id)
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and published_at is null
  and archived_at is null
);

create policy "PIC edits announcement content"
on public.announcements for update to authenticated
using (private.can_manage_team(team_id))
with check (
  private.can_manage_team(team_id)
  and updated_by = auth.uid()
);

create function public.transition_announcement(
  target_announcement_id uuid,
  target_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.announcements%rowtype;
  today_jakarta date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into item
  from public.announcements
  where id = target_announcement_id
  for update;

  if not found or not private.can_manage_team(item.team_id) then
    raise exception 'Pengumuman tidak ditemukan atau tidak dapat dikelola.';
  end if;

  case target_action
    when 'publish' then
      if item.archived_at is not null then
        raise exception 'Pulihkan pengumuman sebelum menerbitkan.';
      end if;
      if item.published_at is not null then
        raise exception 'Pengumuman sudah diterbitkan.';
      end if;
      if item.expires_on is not null and item.expires_on < today_jakarta then
        raise exception 'Tanggal kedaluwarsa sudah lewat.';
      end if;
      update public.announcements
      set published_at = now(), updated_by = auth.uid()
      where id = item.id;
    when 'unpublish' then
      if item.archived_at is not null or item.published_at is null then
        raise exception 'Hanya pengumuman terbit yang dapat ditarik.';
      end if;
      update public.announcements
      set published_at = null, updated_by = auth.uid()
      where id = item.id;
    when 'archive' then
      if item.archived_at is not null then
        raise exception 'Pengumuman sudah diarsipkan.';
      end if;
      update public.announcements
      set published_at = null, archived_at = now(), updated_by = auth.uid()
      where id = item.id;
    when 'restore' then
      if item.archived_at is null then
        raise exception 'Pengumuman ini tidak berada di arsip.';
      end if;
      update public.announcements
      set published_at = null, archived_at = null, updated_by = auth.uid()
      where id = item.id;
    else
      raise exception 'Aksi pengumuman tidak valid.';
  end case;
end;
$$;

revoke all on function public.transition_announcement(uuid, text)
from public, anon;
grant execute on function public.transition_announcement(uuid, text)
to authenticated;
