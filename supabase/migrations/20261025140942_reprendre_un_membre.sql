-- Après avoir rejoint le foyer, un compte peut reprendre une personne déjà créée dans l'app (ex. « Léa », à qui des
-- tâches étaient déjà attribuées), si aucun autre compte ne l'a prise.
create function public.claim_member(p_member_id text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select household_id into hid from public.household_members where user_id = uid;
  if hid is null then raise exception 'Aucun foyer'; end if;
  if exists (select 1 from public.household_members where household_id = hid and member_id = p_member_id and user_id <> uid) then
    raise exception 'Cette personne a déjà un compte dans le foyer';
  end if;
  update public.household_members set member_id = p_member_id where household_id = hid and user_id = uid;
end;
$$;
revoke execute on function public.claim_member(text) from public, anon;
grant execute on function public.claim_member(text) to authenticated;
