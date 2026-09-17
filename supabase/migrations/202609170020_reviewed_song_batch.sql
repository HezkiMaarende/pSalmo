-- Provider-neutral reviewed commit. No pasted input, extraction jobs or AI calls.
create function public.append_reviewed_service_songs(
  target_service_id uuid, expected_revision integer, reviewed_entries jsonb
) returns integer language plpgsql security invoker set search_path=public as $$
declare list_id uuid; actual_revision integer; entry jsonb; song_id uuid; song_title text;
begin
  if jsonb_typeof(reviewed_entries) is distinct from 'array' then
    raise exception 'Daftar lagu harus berupa array.';
  end if;
  if jsonb_array_length(reviewed_entries) not between 1 and 50 then
    raise exception 'Pilih 1–50 lagu.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('psalmo-service:'||target_service_id::text,0));
  if not exists(select 1 from public.services where id=target_service_id and private.can_edit_service(id)) then
    raise exception 'Ibadah tidak dapat diedit.';
  end if;
  select id,revision into list_id,actual_revision from public.setlists where service_id=target_service_id for update;
  actual_revision := coalesce(actual_revision,1);
  if expected_revision is null or expected_revision <> actual_revision then
    raise sqlstate 'PT409' using message='Daftar lagu berubah. Buat ulang pratinjau sebelum menambahkan.';
  end if;
  for entry in select value from jsonb_array_elements(reviewed_entries) loop
    if jsonb_typeof(entry) is distinct from 'object' then raise exception 'Kandidat lagu tidak valid.'; end if;
    if exists(select 1 from jsonb_object_keys(entry) k where k not in ('title','song_id')) then
      raise exception 'Kandidat berisi kolom yang tidak didukung.';
    end if;
    if jsonb_typeof(entry->'title') is distinct from 'string' then raise exception 'Judul wajib berupa teks.'; end if;
    song_title := trim(entry->>'title');
    if char_length(song_title) not between 1 and 200 then raise exception 'Isi judul lagu maksimal 200 karakter.'; end if;
    if entry->'song_id' is not null and jsonb_typeof(entry->'song_id') not in ('null','string') then
      raise exception 'ID lagu tidak valid.';
    end if;
    song_id := (entry->>'song_id')::uuid;
    -- Existing invoker/RLS append copies canonical defaults, lyrics and references;
    -- unknown titles stay service-only. A later error rolls back the entire batch.
    if song_id is null then
      perform public.append_service_songs(target_service_id, array[song_title]);
    else
      perform public.append_service_songs(target_service_id, canonical_song_id=>song_id);
    end if;
  end loop;
  select revision into actual_revision from public.setlists where service_id=target_service_id;
  return actual_revision;
end $$;
revoke all on function public.append_reviewed_service_songs(uuid,integer,jsonb) from public,anon;
grant execute on function public.append_reviewed_service_songs(uuid,integer,jsonb) to authenticated;
