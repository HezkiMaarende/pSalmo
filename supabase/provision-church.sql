-- One-time bootstrap for this deployment. Prototype content is not copied.
do $$
declare church_owner uuid;
begin
  if not exists(select 1 from public.teams where name='GPdI Elshaddai Magelang' and admin_managed) then
    select m.user_id into church_owner from public.teams t join public.team_memberships m on m.team_id=t.id
      where t.name='sounday' and m.role='owner' order by t.created_at limit 1;
    if church_owner is null then raise exception 'Prototype owner not found.'; end if;
    insert into public.teams(name,created_by,admin_managed) values('GPdI Elshaddai Magelang',church_owner,true);
  end if;
end;
$$;
select id from public.teams where name='GPdI Elshaddai Magelang' and admin_managed;
