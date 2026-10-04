create index announcements_created_by_idx
  on public.announcements(created_by);

create index announcements_updated_by_idx
  on public.announcements(updated_by);

drop policy "PIC creates announcement drafts" on public.announcements;
create policy "PIC creates announcement drafts"
on public.announcements for insert to authenticated
with check (
  private.can_manage_team(team_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and published_at is null
  and archived_at is null
);

drop policy "PIC edits announcement content" on public.announcements;
create policy "PIC edits announcement content"
on public.announcements for update to authenticated
using (private.can_manage_team(team_id))
with check (
  private.can_manage_team(team_id)
  and updated_by = (select auth.uid())
);
