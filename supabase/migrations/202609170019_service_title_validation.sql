create function private.validate_church_setlist_title()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(new.proposed_title),'') is null and exists(
    select 1 from public.setlists l join public.services s on s.id=l.service_id
    join public.teams t on t.id=s.team_id
    where l.id=new.setlist_id and t.admin_managed
  ) then
    raise exception 'Judul lagu wajib diisi.' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_church_setlist_title() from public,anon,authenticated;
create trigger validate_church_setlist_title before insert or update of proposed_title
on public.setlist_items for each row execute function private.validate_church_setlist_title();
