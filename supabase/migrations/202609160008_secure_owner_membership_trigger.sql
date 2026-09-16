-- Team creation inserts the creator's owner membership through an after-insert
-- trigger. Membership rows are otherwise RPC-only, so the trigger must run
-- with its table-owner privileges rather than the creating user's RLS context.
alter function private.add_team_creator_as_owner() security definer set search_path = public;
