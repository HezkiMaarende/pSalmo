-- RPCs check current membership and revision in lock_medley_setlist before
-- mutation. Execute as the function owner so private helpers remain uncallable
-- to authenticated clients, including direct PostgREST RPC requests.
alter function private.lock_medley_setlist(uuid,integer) security definer;
alter function private.resequence_medley_items(uuid,uuid[]) security definer;
alter function private.move_medley_unit(uuid,text,text) security definer;
alter function public.save_medley_group(uuid,integer,uuid,uuid,uuid,text) security definer;
alter function public.dissolve_medley_group(uuid,integer,uuid) security definer;
alter function public.move_medley_group(uuid,integer,uuid,text) security definer;
alter function public.delete_setlist_item(uuid,integer,uuid) security definer;
alter function public.move_setlist_item(uuid,text,integer) security definer;
