-- Append under a parent lock; canonical defaults/lyrics/references are snapshots.
create function public.append_service_songs(target_service_id uuid,proposals text[] default '{}',canonical_song_id uuid default null)
returns void language plpgsql security invoker set search_path=public as $$
declare service public.services%rowtype; library_song public.songs%rowtype; list_id uuid; next_position integer; title text; reference_url text;
begin
  select * into service from public.services where id=target_service_id and private.can_edit_service(id) for update;
  if not found then raise exception 'Ibadah tidak dapat diedit.'; end if;
  if cardinality(proposals)>50 then raise exception 'Maksimal 50 lagu sekaligus.'; end if;
  select id into list_id from public.setlists where service_id=service.id;
  if list_id is null then
    insert into public.setlists(service_id,title) values(service.id,service.title || ' setlist') returning id into list_id;
  end if;
  perform 1 from public.setlists where id=list_id for update;
  select coalesce(max(position),-1)+1 into next_position from public.setlist_items where setlist_id=list_id;
  if canonical_song_id is not null then
    select * into library_song from public.songs where id=canonical_song_id and team_id=service.team_id;
    if not found then raise exception 'Lagu tidak ditemukan di Song Bank gereja ini.'; end if;
    select url into reference_url from public.song_references where song_id=library_song.id order by position limit 1;
    insert into public.setlist_items(setlist_id,song_id,proposed_title,artist,position,key,bpm,time_signature,lyrics_or_chords,arrangement_url)
      values(list_id,library_song.id,library_song.title,library_song.artist,next_position,library_song.default_key,
        library_song.default_bpm,library_song.default_time_signature,library_song.lyrics,reference_url);
  else
    for title in select trim(value) from unnest(proposals) with ordinality as input(value,ordinal)
      where trim(value)<>'' group by trim(value) order by min(ordinal) loop
      insert into public.setlist_items(setlist_id,proposed_title,position) values(list_id,title,next_position);
      next_position:=next_position+1;
    end loop;
  end if;
end;
$$;
revoke all on function public.append_service_songs(uuid,text[],uuid) from public,anon;
grant execute on function public.append_service_songs(uuid,text[],uuid) to authenticated;
