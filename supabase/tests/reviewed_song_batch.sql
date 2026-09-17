-- Run as postgres; synthetic accounts/content are rolled back.
begin;
do $$ declare owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); editor_id uuid:=gen_random_uuid();
  t uuid; other_team uuid; service_id uuid; other_service uuid; person uuid; song uuid; foreign_song uuid; ids jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@review-test.invalid','{}'),
    (member_id,member_id::text||'@review-test.invalid','{}'),
    (editor_id,editor_id::text||'@review-test.invalid','{}');
  insert into public.teams(name,created_by,admin_managed) values('Review rollback fixture',owner_id,true) returning id into t;
  insert into public.team_memberships(team_id,user_id,song_editor) values(t,member_id,false),(t,editor_id,true);
  insert into public.services(team_id,title,service_type,service_date,created_by)
    values(t,'Shared IR1/2','ir_1_2','2026-09-20T00:00:00+07',owner_id) returning id into service_id;
  insert into public.services(team_id,title,service_type,service_date,created_by)
    values(t,'Independent IR3','ir_3','2026-09-20T00:00:00+07',owner_id) returning id into other_service;
  insert into public.roster_people(team_id,name,account_id) values(t,'Editor',editor_id) returning id into person;
  insert into public.service_assignments(service_id,person_id,role_name) values(service_id,person,'WL');
  insert into public.teams(name,created_by) values('Foreign review fixture',owner_id) returning id into other_team;
  insert into public.songs(team_id,title,created_by) values(other_team,'Foreign',owner_id) returning id into foreign_song;
  insert into public.songs(team_id,title,default_key,default_bpm,default_time_signature,lyrics,created_by)
    values(t,'Library snapshot','E',110,'6/8','[Verse] Original',owner_id) returning id into song;
  insert into public.song_references(song_id,label,url,position) values(song,'Reference','https://youtu.be/dQw4w9WgXcQ',0);
  ids:=jsonb_build_object('owner',owner_id,'member',member_id,'editor',editor_id,'editor_person',person,'team',t,'service',service_id,'other_service',other_service,'song',song,'foreign_song',foreign_song);
  perform set_config('psalmo.review_fixture',ids::text,true);
end $$;
set local role authenticated;
do $$ declare ids jsonb:=current_setting('psalmo.review_fixture')::jsonb; s uuid:=(ids->>'service')::uuid;
  song uuid:=(ids->>'song')::uuid; revision integer; count_before integer; actual integer;
begin
  perform set_config('request.jwt.claim.sub',ids->>'member',true);
  begin perform public.append_reviewed_service_songs(s,1,'[{"title":"Denied"}]'); raise exception 'FAIL member'; exception when raise_exception then if sqlerrm='FAIL member' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',ids->>'editor',true);
  begin perform public.append_reviewed_service_songs((ids->>'other_service')::uuid,1,'[{"title":"Denied"}]'); raise exception 'FAIL off-duty'; exception when raise_exception then if sqlerrm='FAIL off-duty' then raise; end if; end;
  -- Assigned authorized WL can commit into an initially absent setlist.
  revision := public.append_reviewed_service_songs(s,1,jsonb_build_array(jsonb_build_object('title','Library snapshot','song_id',song),jsonb_build_object('title','New service song','song_id',null),jsonb_build_object('title','New service song','song_id',null)));
  assert (select count(*) from public.setlist_items i join public.setlists l on l.id=i.setlist_id where l.service_id=s)=3, 'ordered batch preserves deliberate repeats';
  assert exists(select 1 from public.setlist_items i join public.setlists l on l.id=i.setlist_id where l.service_id=s and i.position=0 and i.song_id=song and i.key='E' and i.bpm=110 and i.time_signature='6/8' and i.lyrics_or_chords='[Verse] Original' and jsonb_array_length(i.library_references)=1), 'canonical snapshot';
  assert exists(select 1 from public.setlist_items i join public.setlists l on l.id=i.setlist_id where l.service_id=s and i.position=1 and i.song_id is null and i.time_signature='4/4' and i.bpm is null), 'unknown song stays service-only default meter, no BPM';
  assert not exists(select 1 from public.songs where team_id=(ids->>'team')::uuid and title='New service song'), 'no library promotion';
  assert not exists(select 1 from public.setlists where service_id=(ids->>'other_service')::uuid), 'independent IR3';
  begin perform public.append_reviewed_service_songs(s,1,'[{"title":"Retry"}]'); raise exception 'FAIL stale'; exception when sqlstate 'PT409' then null; end;
  select count(*) into count_before from public.setlist_items i join public.setlists l on l.id=i.setlist_id where l.service_id=s;
  begin perform public.append_reviewed_service_songs(s,revision,jsonb_build_array(jsonb_build_object('title','First should rollback'),jsonb_build_object('title','Foreign','song_id',ids->>'foreign_song'))); raise exception 'FAIL foreign'; exception when raise_exception then if sqlerrm='FAIL foreign' then raise; end if; end;
  assert (select count(*) from public.setlist_items i join public.setlists l on l.id=i.setlist_id where l.service_id=s)=count_before, 'failure rolls back earlier inserts';
  select l.revision into actual from public.setlists l where l.service_id=s;
  assert actual=revision, 'failure rolls back revision too';
  begin perform public.append_reviewed_service_songs(s,revision,'[{"title":"Good"},{"title":" "}]'); raise exception 'FAIL blank'; exception when raise_exception then if sqlerrm='FAIL blank' then raise; end if; end;
  begin perform public.append_reviewed_service_songs(s,revision,'[{"title":"Good","team_id":"untrusted"}]'); raise exception 'FAIL unknown field'; exception when raise_exception then if sqlerrm='FAIL unknown field' then raise; end if; end;
  begin perform public.append_reviewed_service_songs(s,null,'[{"title":"Good"}]'); raise exception 'FAIL null revision'; exception when sqlstate 'PT409' then null; end;
  begin perform public.append_reviewed_service_songs(s,revision,'[]'); raise exception 'FAIL empty'; exception when raise_exception then if sqlerrm='FAIL empty' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',ids->>'owner',true);
  update public.songs set lyrics='Changed library' where id=song;
  assert exists(select 1 from public.setlist_items where song_id=song and lyrics_or_chords='[Verse] Original'), 'snapshot isolation';
  perform public.kick_roster_person((ids->>'editor_person')::uuid);
  perform set_config('request.jwt.claim.sub',ids->>'editor',true);
  begin perform public.append_reviewed_service_songs(s,revision,'[{"title":"Kicked"}]'); raise exception 'FAIL kicked'; exception when raise_exception then if sqlerrm='FAIL kicked' then raise; end if; end;
end $$;
reset role;
select 'PASS: atomic reviewed batch, ordered snapshots/proposals/repeats, revision conflicts, membership/duty RLS and foreign-song rollback; fixtures rolled back' as result;
rollback;
