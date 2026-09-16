-- Atomically swap one item with its neighbouring item. Direct client updates
-- would transiently violate the unique (setlist_id, position) constraint.
create or replace function public.move_setlist_item(item_id uuid, move_direction text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_item public.setlist_items%rowtype;
  neighbour_item public.setlist_items%rowtype;
  temporary_position integer;
begin
  if move_direction not in ('up', 'down') then
    raise exception 'move_direction must be up or down';
  end if;

  select i.* into current_item
  from public.setlist_items i
  join public.setlists l on l.id = i.setlist_id
  where i.id = item_id and public.can_edit_service(l.service_id)
  for update;

  if not found then
    raise exception 'setlist item is not editable';
  end if;

  select i.* into neighbour_item
  from public.setlist_items i
  where i.setlist_id = current_item.setlist_id
    and ((move_direction = 'up' and i.position < current_item.position)
      or (move_direction = 'down' and i.position > current_item.position))
  order by
    case when move_direction = 'up' then i.position end desc nulls last,
    case when move_direction = 'down' then i.position end asc nulls last
  limit 1
  for update;

  if not found then return; end if;

  select coalesce(min(position), 0) - 1 into temporary_position
  from public.setlist_items where setlist_id = current_item.setlist_id;
  update public.setlist_items set position = temporary_position where id = current_item.id;
  update public.setlist_items set position = current_item.position where id = neighbour_item.id;
  update public.setlist_items set position = neighbour_item.position where id = current_item.id;
end;
$$;

revoke execute on function public.move_setlist_item(uuid, text) from public;
grant execute on function public.move_setlist_item(uuid, text) to authenticated;
