-- Supabase grants EXECUTE to anon/authenticated by default for new functions.
-- These RPCs are intentionally callable only by a signed-in app user.
revoke all on function public.create_team_invite(uuid, public.membership_role, integer) from anon;
revoke all on function public.accept_team_invite(text) from anon;
revoke all on function public.set_team_member_role(uuid, uuid, public.membership_role) from anon;
revoke all on function public.remove_team_member(uuid, uuid) from anon;
revoke all on function public.revoke_team_invite(uuid) from anon;
