create or replace function public.link_roster_account(target_person_id uuid, registered_email text)
returns void language plpgsql security definer set search_path=public as $$
declare person public.roster_people%rowtype; accounts uuid[]; account uuid;
begin
  select * into person from public.roster_people where id=target_person_id for update;
  if not found or not private.can_manage_team(person.team_id) then raise exception 'Hanya PIC dapat menghubungkan akun.'; end if;
  select array_agg(id) into accounts from auth.users where lower(email)=lower(trim(registered_email));
  if coalesce(cardinality(accounts),0)=0 then raise exception 'Akun belum terdaftar. Minta petugas membuat akun terlebih dahulu.'; end if;
  if cardinality(accounts)<>1 then raise exception 'Email cocok dengan beberapa akun. Hubungi pengelola untuk memeriksa akun.'; end if;
  account := accounts[1];
  if person.account_id is not null and person.account_id<>account then raise exception 'Petugas sudah terhubung. Keluarkan akun lama terlebih dahulu.'; end if;
  if exists(select 1 from public.roster_people where team_id=person.team_id and account_id=account and id<>person.id) then
    raise exception 'Akun sudah ditautkan ke nama petugas lain di gereja ini.';
  end if;
  update public.roster_people set account_id=account,active=true where id=person.id;
  insert into public.team_memberships(team_id,user_id,role) values(person.team_id,account,'member') on conflict do nothing;
end $$;
revoke all on function public.link_roster_account(uuid,text) from public,anon;
grant execute on function public.link_roster_account(uuid,text) to authenticated;
