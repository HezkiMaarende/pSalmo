-- Hosted Supabase places pgcrypto in extensions; local projects may use public.
-- Both are trusted schemas; never include a caller-controlled search path.
alter function public.import_library_songs(uuid,uuid,text,jsonb) set search_path=public,extensions;
