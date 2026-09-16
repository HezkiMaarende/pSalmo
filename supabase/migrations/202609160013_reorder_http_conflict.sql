-- Explicit optimistic-edit conflict: PT409 becomes HTTP 409 in PostgREST,
-- unlike a serialization error (40xxx), which becomes HTTP 500.
do $$ declare definition text; begin
  select pg_get_functiondef('public.move_setlist_item(uuid,text,integer)'::regprocedure) into definition;
  definition := replace(definition, 'errcode=''40001''', 'errcode=''PT409''');
  execute definition;
end $$;
