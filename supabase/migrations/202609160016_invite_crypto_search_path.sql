-- Hosted Supabase installs pgcrypto in extensions; fresh local projects may
-- have it in public. Keep both trusted schemas in this fixed function path.
alter function private.legacy_create_team_invite(uuid,public.membership_role,integer) set search_path=public,extensions;
alter function private.legacy_accept_team_invite(text) set search_path=public,extensions;
alter function public.accept_team_invite(text) set search_path=public,extensions;
