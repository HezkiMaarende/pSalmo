-- Synthetic church and setlist. All writes are rolled back.
begin;
do $$
declare owner_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid();
  fixture_team uuid; fixture_service uuid; fixture_list uuid;
  ids uuid[]:='{}'; row_id uuid; n integer;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@medley.invalid','{}'),
    (outsider_id,outsider_id::text||'@medley.invalid','{}');
  insert into public.teams(name,created_by,admin_managed)
    values('Medley rollback fixture',owner_id,true) returning id into fixture_team;
  insert into public.services(team_id,title,service_type,service_date,created_by)
    values(fixture_team,'Medley fixture','ir_1_2','2032-01-04T00:00:00+07:00',owner_id)
    returning id into fixture_service;
  insert into public.setlists(service_id,title) values(fixture_service,'Fixture') returning id into fixture_list;
  for n in 0..4 loop
    insert into public.setlist_items(setlist_id,position,proposed_title)
      values(fixture_list,n,'Fixture '||n) returning id into row_id;
    ids:=array_append(ids,row_id);
  end loop;
  perform set_config('psalmo.medley_fixture',jsonb_build_object(
    'owner',owner_id,'outsider',outsider_id,'team',fixture_team,
    'service',fixture_service,'list',fixture_list,'items',ids)::text,true);
end $$;
set local role authenticated;
do $$
declare f jsonb:=current_setting('psalmo.medley_fixture')::jsonb;
  owner_id uuid:=(f->>'owner')::uuid; outsider_id uuid:=(f->>'outsider')::uuid;
  service_id uuid:=(f->>'service')::uuid; list_id uuid:=(f->>'list')::uuid;
  ids uuid[]; rev integer; group_id uuid; stale boolean:=false;
begin
  select array_agg(value::uuid order by ord) into ids
    from jsonb_array_elements_text(f->'items') with ordinality as x(value,ord);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select revision into rev from public.setlists where id=list_id;
  group_id:=public.save_medley_group(service_id,rev,null,ids[2],ids[3],'Pembukaan');
  assert (select count(*) from public.setlist_items where medley_group_id=group_id)=2,
    'group contains two songs';
  assert (select position from public.medley_groups where id=group_id)=1,
    'group position follows first song';
  begin
    update public.setlist_items set medley_group_id=null where id=ids[2];
    set constraints all immediate;
    raise exception 'FAIL direct API left a one-song group';
  exception when others then
    if sqlerrm='FAIL direct API left a one-song group' then raise; end if;
  end;
  assert (select count(*) from public.setlist_items where medley_group_id=group_id)=2,
    'invalid direct mutation was rolled back';
  begin
    perform public.move_medley_group(service_id,rev,group_id,'down');
  exception when sqlstate 'PT409' then stale:=true;
  end;
  assert stale,'stale revision rejected';
  select revision into rev from public.setlists where id=list_id;
  perform public.move_medley_group(service_id,rev,group_id,'down');
  assert (select position from public.medley_groups where id=group_id)=2,
    'whole group moved past one song';
  select revision into rev from public.setlists where id=list_id;
  perform public.move_setlist_item(ids[2],'down',rev);
  assert (select position from public.setlist_items where id=ids[2])>
    (select position from public.setlist_items where id=ids[3]),
    'internal song swap stays inside group';
  select revision into rev from public.setlists where id=list_id;
  perform public.save_medley_group(service_id,rev,group_id,ids[4],ids[2],'Baru');
  assert (select count(*) from public.setlist_items where medley_group_id=group_id)=3,
    'group resize includes adjacent song';
  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  assert not exists(select 1 from public.medley_groups where id=group_id),
    'outsider cannot read group';
  begin
    perform public.dissolve_medley_group(service_id,rev,group_id);
    raise exception 'FAIL outsider changed group';
  exception when others then
    if sqlerrm='FAIL outsider changed group' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select revision into rev from public.setlists where id=list_id;
  perform public.delete_setlist_item(service_id,rev,ids[2]);
  assert (select count(*) from public.setlist_items where medley_group_id=group_id)=2,
    'delete leaves valid two-song group';
  select revision into rev from public.setlists where id=list_id;
  perform public.delete_setlist_item(service_id,rev,ids[3]);
  assert not exists(select 1 from public.medley_groups where id=group_id),
    'delete dissolves one-song group';
end $$;
select 'PASS: medley grouping, move, stale conflict, access and deletion; rolled back' as result;
rollback;
