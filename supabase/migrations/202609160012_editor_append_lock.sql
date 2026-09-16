-- A service FOR UPDATE lock requires the PIC-only UPDATE policy. Serialize
-- first-list creation with an advisory lock instead, retaining invoker/RLS.
do $$ declare definition text; begin
  select pg_get_functiondef('public.append_service_songs(uuid,text[],uuid)'::regprocedure) into definition;
  definition := replace(definition,
    'select * into service from public.services where id=target_service_id and private.can_edit_service(id) for update;',
    'perform pg_advisory_xact_lock(hashtextextended(''psalmo-service:''||target_service_id::text,0));
     select * into service from public.services where id=target_service_id and private.can_edit_service(id);');
  execute definition;
  select pg_get_functiondef('public.move_setlist_item(uuid,text,integer)'::regprocedure) into definition;
  definition := replace(definition, 'if move_direction not in', 'if expected_revision is null then raise exception ''Expected revision is required.''; end if;
  if move_direction is null or move_direction not in');
  execute definition;
end $$;
