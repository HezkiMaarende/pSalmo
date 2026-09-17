-- Default missing meters only for admin-managed church workspaces. The
-- prototype's records and write behavior remain unchanged.
create function private.default_church_meter()
returns trigger language plpgsql security definer set search_path=public as $$
declare church uuid;
begin
  if tg_table_name='songs' then
    church:=new.team_id;
    if nullif(trim(new.default_time_signature),'') is null and exists(select 1 from public.teams where id=church and admin_managed) then
      new.default_time_signature:='4/4';
    end if;
  else
    select s.team_id into church from public.setlists l join public.services s on s.id=l.service_id where l.id=new.setlist_id;
    if nullif(trim(new.time_signature),'') is null and exists(select 1 from public.teams where id=church and admin_managed) then
      new.time_signature:='4/4';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.default_church_meter() from public,anon,authenticated;
create trigger default_church_song_meter before insert or update on public.songs
for each row execute function private.default_church_meter();
create trigger default_church_item_meter before insert or update on public.setlist_items
for each row execute function private.default_church_meter();

-- Resolve the approved workspace by its stable church identity, never by a
-- generated UUID. Fail closed rather than backfilling an ambiguous workspace.
do $$
declare church uuid;
begin
  if (select count(*) from public.teams where name='GPdI Elshaddai Magelang' and admin_managed)<>1 then
    raise exception 'Expected one GPdI Elshaddai Magelang workspace';
  end if;
  select id into church from public.teams where name='GPdI Elshaddai Magelang' and admin_managed;
  update public.songs set default_time_signature='4/4' where team_id=church and nullif(trim(default_time_signature),'') is null;
  update public.setlist_items i set time_signature='4/4' from public.setlists l,public.services s
    where i.setlist_id=l.id and l.service_id=s.id and s.team_id=church and nullif(trim(i.time_signature),'') is null;
end $$;
