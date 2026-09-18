-- Permission notes are no longer required. Preserve prior notes/receipts and editor guards.
create or replace function public.import_library_songs(target_team_id uuid,batch_id uuid,permission_note text,reviewed_entries jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare entry jsonb; song_id uuid; existing_id uuid; payload text; receipt private.library_import_receipts%rowtype;
  created jsonb:='[]'; skipped jsonb:='[]'; output jsonb; signature text; bpm_value numeric;
begin
  if auth.uid() is null or not private.can_manage_library(target_team_id) then raise exception 'Anda tidak memiliki akses editor lagu.'; end if;
  if not exists(select 1 from public.teams where id=target_team_id and admin_managed) then raise exception 'Import hanya untuk gereja terkelola.'; end if;
  if batch_id is null then raise exception 'Batch ID wajib diisi.'; end if;
  if coalesce(char_length(trim(permission_note)),0)>2000 then raise exception 'Catatan import maksimal 2.000 karakter.'; end if;
  if jsonb_typeof(reviewed_entries) is distinct from 'array' then raise exception 'Daftar import harus berupa array.'; end if;
  if jsonb_array_length(reviewed_entries) not between 1 and 50 then raise exception 'Pilih 1–50 lagu.'; end if;
  if octet_length(reviewed_entries::text)>4*1024*1024 then raise exception 'Payload import terlalu besar.'; end if;
  payload:=encode(digest(jsonb_build_object('permission',trim(permission_note),'entries',reviewed_entries)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('psalmo-library:'||target_team_id::text,0));
  select * into receipt from private.library_import_receipts r where r.team_id=target_team_id and r.caller_id=auth.uid() and r.batch_id=import_library_songs.batch_id;
  if found then
    if receipt.payload_hash<>payload then raise sqlstate 'PT409' using message='Batch ID sudah digunakan dengan isi berbeda.'; end if;
    return receipt.result;
  end if;
  -- Validate every selected entry first, including duplicates. An error must
  -- never become an apparently successful skipped invalid row.
  for entry in select value from jsonb_array_elements(reviewed_entries) loop
    if jsonb_typeof(entry) is distinct from 'object' then raise exception 'Kandidat import tidak valid.'; end if;
    if exists(select 1 from jsonb_object_keys(entry) k where k not in ('source_filename','title','artist','lyrics','writer_credits','copyright_notice','key','bpm','time_signature')) then raise exception 'Kolom import tidak didukung.'; end if;
    if exists(select 1 from unnest(array['source_filename','title','artist','lyrics','writer_credits','copyright_notice','key','time_signature']) k where jsonb_typeof(entry->k) is distinct from 'string') then raise exception 'Kolom teks import wajib berupa teks.'; end if;
    if char_length(trim(entry->>'title')) not between 1 and 200 or char_length(entry->>'artist')>200 then raise exception 'Judul/artis maksimal 200 karakter.'; end if;
    if char_length(trim(entry->>'lyrics'))<1 or char_length(entry->>'lyrics')>102400 then raise exception 'Lirik kosong/terlalu besar.'; end if;
    if (entry->>'lyrics') ~ E'[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]' then raise exception 'Lirik mengandung kontrol/binary.'; end if;
    if char_length(entry->>'source_filename') not between 5 and 255 or (entry->>'source_filename') !~* '\.(txt|pro|propresenter)$' or (entry->>'source_filename') ~ E'[/\\\\\u0001-\u001f]' then raise exception 'Nama file .txt/.pro/.propresenter tidak valid.'; end if;
    if char_length(entry->>'writer_credits')>2000 or char_length(entry->>'copyright_notice')>2000 or char_length(entry->>'key')>20 then raise exception 'Kredit/copyright/key terlalu panjang.'; end if;
    signature:=entry->>'time_signature';
    if signature !~ '^([1-9]|1[0-2])/(2|4|8)$' then raise exception 'Pilih salah satu dari 36 birama.'; end if;
    if entry->'bpm' is null or jsonb_typeof(entry->'bpm') not in ('number','null') then raise exception 'BPM harus angka atau null.'; end if;
    if jsonb_typeof(entry->'bpm')='number' then
      bpm_value:=(entry->>'bpm')::numeric;
      if bpm_value<>trunc(bpm_value) or bpm_value not between 20 and 400 then raise exception 'BPM harus bilangan bulat 20–400.'; end if;
    end if;
  end loop;
  for entry in select value from jsonb_array_elements(reviewed_entries) loop
    existing_id:=null;
    select id into existing_id from public.songs where team_id=target_team_id
      and private.library_identity(title)=private.library_identity(entry->>'title')
      and private.library_identity(artist)=private.library_identity(entry->>'artist') order by id limit 1;
    if existing_id is not null then
      skipped:=skipped||jsonb_build_array(jsonb_build_object('id',existing_id,'title',trim(entry->>'title'),'source_filename',entry->>'source_filename'));
    else
      song_id:=public.save_library_song(target_team_id,null,entry,'[]');
      update public.songs set source_type=case when (entry->>'source_filename') ~* '\.txt$' then 'propresenter_text' else 'propresenter_native' end,source_filename=entry->>'source_filename',permission_basis=nullif(trim(permission_note),'') where id=song_id;
      created:=created||jsonb_build_array(jsonb_build_object('id',song_id,'title',trim(entry->>'title'),'source_filename',entry->>'source_filename'));
    end if;
  end loop;
  output:=jsonb_build_object('created',created,'skipped',skipped);
  insert into private.library_import_receipts(team_id,caller_id,batch_id,payload_hash,result) values(target_team_id,auth.uid(),batch_id,payload,output);
  return output;
end $$;
revoke all on function public.import_library_songs(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.import_library_songs(uuid,uuid,text,jsonb) to authenticated;
