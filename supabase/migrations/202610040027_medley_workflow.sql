-- Existing medley tables are empty in the church workspace. Keep the
-- existing setlist/item identity and enforce the grouping contract at commit.
alter table public.medley_groups
  add constraint medley_label_length check (
    label is null or char_length(trim(label)) between 1 and 80
  );
create index setlist_items_medley_group_idx
  on public.setlist_items(medley_group_id);

create function private.assert_medley_invariants(target_setlist_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare grouped record;
begin
  for grouped in
    select g.id, g.position, count(i.id) as member_count, min(i.position) as first_position,
      max(i.position) as last_position
    from public.medley_groups g
    left join public.setlist_items i on i.medley_group_id=g.id
    where g.setlist_id=target_setlist_id
    group by g.id,g.position
  loop
    if grouped.member_count < 2 or grouped.position is distinct from grouped.first_position then
      raise exception 'Medley harus memiliki minimal dua lagu dan posisi awal yang benar.';
    end if;
    if exists (
      select 1 from public.setlist_items i
      where i.setlist_id=target_setlist_id
        and i.position between grouped.first_position and grouped.last_position
        and i.medley_group_id is distinct from grouped.id
    ) then
      raise exception 'Lagu medley harus berurutan.';
    end if;
  end loop;
end $$;
revoke all on function private.assert_medley_invariants(uuid) from public,anon,authenticated;

create function private.validate_medley_final_state()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='setlist_items' then
    perform private.assert_medley_invariants(coalesce(new.setlist_id,old.setlist_id));
    if tg_op='UPDATE' and old.setlist_id<>new.setlist_id then
      perform private.assert_medley_invariants(old.setlist_id);
    end if;
  else
    perform private.assert_medley_invariants(coalesce(new.setlist_id,old.setlist_id));
  end if;
  return null;
end $$;
revoke all on function private.validate_medley_final_state() from public,anon,authenticated;
create constraint trigger validate_medley_items
after insert or update or delete on public.setlist_items
deferrable initially deferred for each row
execute function private.validate_medley_final_state();
create constraint trigger validate_medley_groups
after insert or update or delete on public.medley_groups
deferrable initially deferred for each row
execute function private.validate_medley_final_state();

create function private.track_medley_mutation()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  update public.setlists set revision=revision+1
  where id=coalesce(new.setlist_id,old.setlist_id);
  return coalesce(new,old);
end $$;
revoke all on function private.track_medley_mutation() from public,anon,authenticated;
create trigger track_medley_mutation
after insert or update or delete on public.medley_groups
for each row execute function private.track_medley_mutation();

create function private.lock_medley_setlist(
  target_service_id uuid, expected_revision integer
) returns uuid language plpgsql security invoker set search_path=public as $$
declare list_id uuid; current_revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('psalmo-service:'||target_service_id::text,0));
  select l.id,l.revision into list_id,current_revision
  from public.setlists l where l.service_id=target_service_id
    and private.can_edit_service(target_service_id) for update;
  if list_id is null then raise exception 'Setlist tidak dapat diedit.'; end if;
  if expected_revision is null or expected_revision<>current_revision then
    raise sqlstate 'PT409' using message='Setlist berubah. Muat ulang lalu coba lagi.';
  end if;
  return list_id;
end $$;
revoke all on function private.lock_medley_setlist(uuid,integer) from public,anon,authenticated;

create function private.resequence_medley_items(target_setlist_id uuid, ordered_ids uuid[])
returns void language plpgsql security invoker set search_path=public as $$
declare item_id uuid; group_row record; counter integer:=0; temporary_start integer;
begin
  if coalesce(array_length(ordered_ids,1),0) <>
    (select count(*) from public.setlist_items where setlist_id=target_setlist_id)
    or (select count(distinct id) from unnest(ordered_ids) as ids(id)) <>
      coalesce(array_length(ordered_ids,1),0)
    or exists (
      select 1 from unnest(ordered_ids) as ids(id)
      where not exists(select 1 from public.setlist_items i
        where i.id=ids.id and i.setlist_id=target_setlist_id)
    ) then
    raise exception 'Urutan setlist tidak valid.';
  end if;
  select coalesce(min(position),0)-coalesce(array_length(ordered_ids,1),0)-1
    into temporary_start from public.setlist_items where setlist_id=target_setlist_id;
  foreach item_id in array ordered_ids loop
    update public.setlist_items set position=temporary_start-counter where id=item_id;
    counter:=counter+1;
  end loop;
  counter:=0;
  foreach item_id in array ordered_ids loop
    update public.setlist_items set position=counter where id=item_id;
    counter:=counter+1;
  end loop;
  -- Group positions have their own immediate unique constraint.
  for group_row in select id from public.medley_groups
    where setlist_id=target_setlist_id order by position loop
    update public.medley_groups set position=temporary_start-counter where id=group_row.id;
    counter:=counter+1;
  end loop;
  for group_row in select g.id,min(i.position) as first_position
    from public.medley_groups g join public.setlist_items i on i.medley_group_id=g.id
    where g.setlist_id=target_setlist_id group by g.id order by min(i.position) loop
    update public.medley_groups set position=group_row.first_position where id=group_row.id;
  end loop;
end $$;
revoke all on function private.resequence_medley_items(uuid,uuid[]) from public,anon,authenticated;

create function public.save_medley_group(
  target_service_id uuid, expected_revision integer, target_group_id uuid,
  first_item_id uuid, last_item_id uuid, group_label text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare list_id uuid; first_position integer; last_position integer;
  old_first integer; old_last integer; saved_id uuid; selected_count integer;
begin
  list_id:=private.lock_medley_setlist(target_service_id,expected_revision);
  if group_label is not null and char_length(trim(group_label))>80 then
    raise exception 'Label medley maksimal 80 karakter.';
  end if;
  select position into first_position from public.setlist_items
    where id=first_item_id and setlist_id=list_id;
  select position into last_position from public.setlist_items
    where id=last_item_id and setlist_id=list_id;
  if first_position is null or last_position is null or first_position>=last_position then
    raise exception 'Pilih lagu awal dan akhir yang berurutan.';
  end if;
  select count(*) into selected_count from public.setlist_items
    where setlist_id=list_id and position between first_position and last_position;
  if selected_count<2 then raise exception 'Medley memerlukan minimal dua lagu.'; end if;
  if exists(select 1 from public.setlist_items
      where setlist_id=list_id and position between first_position and last_position
        and medley_group_id is not null
        and medley_group_id is distinct from target_group_id) then
    raise exception 'Rentang mengambil lagu dari medley lain.';
  end if;
  if target_group_id is null then
    insert into public.medley_groups(setlist_id,position,label)
      values(list_id,first_position,nullif(trim(group_label),''))
      returning id into saved_id;
  else
    select min(position),max(position) into old_first,old_last
      from public.setlist_items where setlist_id=list_id
        and medley_group_id=target_group_id;
    if old_first is null or old_last<first_position or old_first>last_position then
      raise exception 'Rentang edit harus mencakup medley saat ini.';
    end if;
    update public.medley_groups set label=nullif(trim(group_label),''),
      position=first_position where id=target_group_id and setlist_id=list_id
      returning id into saved_id;
    if saved_id is null then raise exception 'Medley tidak ditemukan.'; end if;
    update public.setlist_items set medley_group_id=null
      where setlist_id=list_id and medley_group_id=saved_id
        and (position<first_position or position>last_position);
  end if;
  update public.setlist_items set medley_group_id=saved_id
    where setlist_id=list_id and position between first_position and last_position
      and medley_group_id is distinct from saved_id;
  return saved_id;
end $$;

create function public.dissolve_medley_group(
  target_service_id uuid, expected_revision integer, target_group_id uuid
) returns integer language plpgsql security invoker set search_path=public as $$
declare list_id uuid; result_revision integer;
begin
  list_id:=private.lock_medley_setlist(target_service_id,expected_revision);
  if not exists(select 1 from public.medley_groups
    where id=target_group_id and setlist_id=list_id) then
    raise exception 'Medley tidak ditemukan.';
  end if;
  update public.setlist_items set medley_group_id=null
    where setlist_id=list_id and medley_group_id=target_group_id;
  delete from public.medley_groups where id=target_group_id and setlist_id=list_id;
  select revision into result_revision from public.setlists where id=list_id;
  return result_revision;
end $$;

create function private.move_medley_unit(
  target_setlist_id uuid, target_key text, move_direction text
) returns void language plpgsql security invoker set search_path=public as $$
declare unit_keys text[]; unit_key text; ordered_ids uuid[]:='{}'; part uuid[];
  unit_index integer; neighbour_index integer; temporary text;
begin
  select array_agg(key order by first_position) into unit_keys from (
    select case when medley_group_id is null then 's:'||id::text
      else 'g:'||medley_group_id::text end as key,min(position) as first_position
    from public.setlist_items where setlist_id=target_setlist_id group by 1
  ) units;
  unit_index:=array_position(unit_keys,target_key);
  if unit_index is null then raise exception 'Lagu atau medley tidak ditemukan.'; end if;
  neighbour_index:=unit_index+case when move_direction='up' then -1 else 1 end;
  if neighbour_index<1 or neighbour_index>array_length(unit_keys,1) then return; end if;
  temporary:=unit_keys[unit_index];
  unit_keys[unit_index]:=unit_keys[neighbour_index];
  unit_keys[neighbour_index]:=temporary;
  foreach unit_key in array unit_keys loop
    if left(unit_key,2)='g:' then
      select array_agg(id order by position) into part from public.setlist_items
        where setlist_id=target_setlist_id
          and medley_group_id=substring(unit_key from 3)::uuid;
    else
      part:=array[substring(unit_key from 3)::uuid];
    end if;
    ordered_ids:=ordered_ids||coalesce(part,'{}'::uuid[]);
  end loop;
  perform private.resequence_medley_items(target_setlist_id,ordered_ids);
end $$;
revoke all on function private.move_medley_unit(uuid,text,text) from public,anon,authenticated;

create or replace function public.move_setlist_item(
  item_id uuid, move_direction text, expected_revision integer
) returns integer language plpgsql security invoker set search_path=public as $$
declare target_service_id uuid; list_id uuid; item public.setlist_items%rowtype;
  neighbour_id uuid; ordered_ids uuid[]; item_index integer; neighbour_index integer;
  temporary uuid; result_revision integer;
begin
  if move_direction is null or move_direction not in ('up','down') then
    raise exception 'Arah tidak valid.';
  end if;
  select l.service_id into target_service_id from public.setlist_items i
    join public.setlists l on l.id=i.setlist_id where i.id=item_id;
  if target_service_id is null then raise exception 'Lagu tidak dapat diakses.'; end if;
  list_id:=private.lock_medley_setlist(target_service_id,expected_revision);
  select * into item from public.setlist_items where id=item_id and setlist_id=list_id;
  if item.medley_group_id is null then
    perform private.move_medley_unit(list_id,'s:'||item_id::text,move_direction);
  else
    select id into neighbour_id from public.setlist_items
      where setlist_id=list_id and medley_group_id=item.medley_group_id
        and ((move_direction='up' and position<item.position)
          or (move_direction='down' and position>item.position))
      order by case when move_direction='up' then position end desc nulls last,
        case when move_direction='down' then position end asc nulls last limit 1;
    if neighbour_id is not null then
      select array_agg(id order by position) into ordered_ids from public.setlist_items
        where setlist_id=list_id;
      item_index:=array_position(ordered_ids,item_id);
      neighbour_index:=array_position(ordered_ids,neighbour_id);
      temporary:=ordered_ids[item_index];
      ordered_ids[item_index]:=ordered_ids[neighbour_index];
      ordered_ids[neighbour_index]:=temporary;
      perform private.resequence_medley_items(list_id,ordered_ids);
    end if;
  end if;
  select revision into result_revision from public.setlists where id=list_id;
  return result_revision;
end $$;

create function public.move_medley_group(
  target_service_id uuid, expected_revision integer,
  target_group_id uuid, move_direction text
) returns integer language plpgsql security invoker set search_path=public as $$
declare list_id uuid; result_revision integer;
begin
  if move_direction is null or move_direction not in ('up','down') then
    raise exception 'Arah tidak valid.';
  end if;
  list_id:=private.lock_medley_setlist(target_service_id,expected_revision);
  if not exists(select 1 from public.medley_groups
    where id=target_group_id and setlist_id=list_id) then
    raise exception 'Medley tidak ditemukan.';
  end if;
  perform private.move_medley_unit(list_id,'g:'||target_group_id::text,move_direction);
  select revision into result_revision from public.setlists where id=list_id;
  return result_revision;
end $$;

create function public.delete_setlist_item(
  target_service_id uuid, expected_revision integer, target_item_id uuid
) returns integer language plpgsql security invoker set search_path=public as $$
declare list_id uuid; group_id uuid; ordered_ids uuid[]; result_revision integer;
begin
  list_id:=private.lock_medley_setlist(target_service_id,expected_revision);
  delete from public.setlist_items where id=target_item_id and setlist_id=list_id
    returning medley_group_id into group_id;
  if not found then raise exception 'Lagu tidak ditemukan.'; end if;
  if group_id is not null and
    (select count(*) from public.setlist_items where medley_group_id=group_id)<2 then
    update public.setlist_items set medley_group_id=null where medley_group_id=group_id;
    delete from public.medley_groups where id=group_id;
  end if;
  select coalesce(array_agg(id order by position),'{}'::uuid[]) into ordered_ids
    from public.setlist_items where setlist_id=list_id;
  perform private.resequence_medley_items(list_id,ordered_ids);
  select revision into result_revision from public.setlists where id=list_id;
  return result_revision;
end $$;

revoke all on function public.save_medley_group(uuid,integer,uuid,uuid,uuid,text),
  public.dissolve_medley_group(uuid,integer,uuid),
  public.move_medley_group(uuid,integer,uuid,text),
  public.delete_setlist_item(uuid,integer,uuid) from public,anon;
grant execute on function public.save_medley_group(uuid,integer,uuid,uuid,uuid,text),
  public.dissolve_medley_group(uuid,integer,uuid),
  public.move_medley_group(uuid,integer,uuid,text),
  public.delete_setlist_item(uuid,integer,uuid) to authenticated;
