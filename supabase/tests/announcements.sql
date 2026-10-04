-- Synthetic announcement access/state fixture. Every write is rolled back.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  editor_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  fixture_team uuid;
  other_team uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@announcement.invalid','{}'),
    (admin_id,admin_id::text||'@announcement.invalid','{}'),
    (member_id,member_id::text||'@announcement.invalid','{}'),
    (editor_id,editor_id::text||'@announcement.invalid','{}'),
    (outsider_id,outsider_id::text||'@announcement.invalid','{}');
  insert into public.teams(name,created_by,admin_managed)
    values('Announcement rollback fixture',owner_id,true) returning id into fixture_team;
  insert into public.team_memberships(team_id,user_id,role) values
    (fixture_team,admin_id,'admin'),
    (fixture_team,member_id,'member'),
    (fixture_team,editor_id,'member');
  update public.team_memberships m set song_editor=true
    where m.team_id=fixture_team and m.user_id=editor_id;
  insert into public.teams(name,created_by,admin_managed)
    values('Other announcement fixture',outsider_id,true) returning id into other_team;

  insert into public.announcements(
    team_id,title,body,published_at,expires_on,created_by,updated_by
  ) values (
    fixture_team,'Expired fixture','No longer active',now(),
    (now() at time zone 'Asia/Jakarta')::date-1,owner_id,owner_id
  );
  insert into public.announcements(
    team_id,title,body,published_at,created_by,updated_by
  ) values (
    other_team,'Other church','Must remain private',now(),outsider_id,outsider_id
  );
  perform set_config(
    'psalmo.announcement_fixture',
    jsonb_build_object(
      'owner',owner_id,'admin',admin_id,'member',member_id,
      'editor',editor_id,'outsider',outsider_id,'team',fixture_team,
      'other_team',other_team
    )::text,
    true
  );
end $$;

set local role authenticated;

do $$
declare
  fixture jsonb := current_setting('psalmo.announcement_fixture')::jsonb;
  owner_id uuid := (fixture->>'owner')::uuid;
  admin_id uuid := (fixture->>'admin')::uuid;
  member_id uuid := (fixture->>'member')::uuid;
  editor_id uuid := (fixture->>'editor')::uuid;
  outsider_id uuid := (fixture->>'outsider')::uuid;
  fixture_team uuid := (fixture->>'team')::uuid;
  draft_id uuid;
  second_id uuid;
  rows_changed integer;
  first_id uuid;
begin
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  insert into public.announcements(
    team_id,title,body,external_url,pinned,expires_on,created_by,updated_by
  ) values (
    fixture_team,'Latihan Minggu','Latihan dimulai pukul 18.00.',
    'https://example.com/info',false,
    (now() at time zone 'Asia/Jakarta')::date+7,owner_id,owner_id
  ) returning id into draft_id;

  assert exists(
    select 1 from public.announcements where id=draft_id and published_at is null
  ), 'owner sees draft';

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  assert not exists(
    select 1 from public.announcements where id=draft_id
  ), 'member cannot see draft';
  begin
    insert into public.announcements(team_id,title,body,created_by,updated_by)
      values(fixture_team,'Illegal member draft','Blocked',member_id,member_id);
    raise exception 'FAIL member created announcement';
  exception when others then
    if sqlerrm='FAIL member created announcement' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.transition_announcement(draft_id,'publish');
  assert exists(
    select 1 from public.announcements where id=draft_id and published_at is not null
  ), 'owner published with server transition';
  begin
    update public.announcements set published_at=now() where id=draft_id;
    raise exception 'FAIL status column updated directly';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  assert exists(
    select 1 from public.announcements where id=draft_id
  ), 'member reads active announcement';
  assert not exists(
    select 1 from public.announcements where title='Expired fixture'
  ), 'member cannot read expired announcement';
  assert not exists(
    select 1 from public.announcements where title='Other church'
  ), 'member cannot read another church announcement';

  perform set_config('request.jwt.claim.sub',editor_id::text,true);
  update public.announcements
    set title='Illegal editor update',updated_by=editor_id where id=draft_id;
  get diagnostics rows_changed=row_count;
  assert rows_changed=0, 'song editor cannot edit announcements';
  assert exists(
    select 1 from public.announcements where id=draft_id
  ), 'song editor still reads active announcement';

  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  assert not exists(
    select 1 from public.announcements where id=draft_id
  ), 'outsider cannot read church announcement';

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  insert into public.announcements(
    team_id,title,body,pinned,created_by,updated_by
  ) values (
    fixture_team,'Pengumuman semat','Penting',true,admin_id,admin_id
  ) returning id into second_id;
  perform public.transition_announcement(second_id,'publish');
  select a.id into first_id from public.announcements a
    where a.team_id=fixture_team and a.published_at is not null and a.archived_at is null
      and (a.expires_on is null or a.expires_on >= (now() at time zone 'Asia/Jakarta')::date)
    order by a.pinned desc,a.published_at desc limit 1;
  assert first_id=second_id, 'pinned announcement orders first';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  update public.announcements
    set pinned=true,updated_by=owner_id where id=draft_id;
  assert exists(
    select 1 from public.announcements where id=draft_id and pinned
  ), 'owner can pin published content';
  perform public.transition_announcement(draft_id,'unpublish');
  assert exists(
    select 1 from public.announcements where id=draft_id and published_at is null
  ), 'unpublish returns to draft';
  perform public.transition_announcement(draft_id,'publish');
  perform public.transition_announcement(draft_id,'archive');
  assert exists(
    select 1 from public.announcements
      where id=draft_id and archived_at is not null and published_at is null
  ), 'archive hides and unpublishes';

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  assert not exists(
    select 1 from public.announcements where id=draft_id
  ), 'member cannot read archive';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.transition_announcement(draft_id,'restore');
  assert exists(
    select 1 from public.announcements
      where id=draft_id and archived_at is null and published_at is null
  ), 'restore always returns to draft';
  begin
    delete from public.announcements where id=draft_id;
    raise exception 'FAIL owner hard-deleted announcement';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.announcements(
      team_id,title,body,external_url,created_by,updated_by
    ) values (
      fixture_team,'Bad URL','Blocked','http://example.com',owner_id,owner_id
    );
    raise exception 'FAIL non-HTTPS URL accepted';
  exception when check_violation then null;
  end;

  insert into public.announcements(
    team_id,title,body,expires_on,created_by,updated_by
  ) values (
    fixture_team,'Past expiry','Blocked on publish',
    (now() at time zone 'Asia/Jakarta')::date-1,owner_id,owner_id
  ) returning id into draft_id;
  begin
    perform public.transition_announcement(draft_id,'publish');
    raise exception 'FAIL past expiry published';
  exception when raise_exception then
    if sqlerrm='FAIL past expiry published' then raise; end if;
  end;

  begin
    perform public.transition_announcement(draft_id,'invalid');
    raise exception 'FAIL invalid transition accepted';
  exception when raise_exception then
    if sqlerrm='FAIL invalid transition accepted' then raise; end if;
  end;
end $$;

select 'PASS: announcement RLS, lifecycle, expiry, pinning and no hard delete; all fixtures rolled back' as result;
rollback;
