-- Cadence : un foyer (household), ses membres (comptes), et une table générique d'enregistrements synchronisés.
-- Chaque enregistrement = un objet de l'app (tâche, routine, séance, article de courses…) en jsonb, jamais supprimé
-- physiquement (deleted = true) pour que la suppression se propage aux autres appareils.

create schema if not exists private;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Notre foyer',
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id text not null,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (household_id, member_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.records (
  household_id uuid not null references public.households (id) on delete cascade,
  collection text not null check (collection in ('members', 'tasks', 'routines', 'weeks', 'programs', 'sessions', 'runs', 'goals', 'habits', 'lists', 'items', 'frequent')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (household_id, collection, id)
);
create index records_household_updated_idx on public.records (household_id, updated_at);

-- L'heure et l'auteur sont posés par le serveur.
create function private.touch_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger records_touch before insert or update on public.records
for each row execute function private.touch_record();

-- Appartenance au foyer (security definer : évite la récursion des politiques sur household_members).
create function private.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.records enable row level security;

create policy "Les membres voient leur foyer" on public.households
  for select to authenticated using (private.is_member(id));
create policy "Les membres renomment leur foyer" on public.households
  for update to authenticated using (private.is_member(id)) with check (private.is_member(id));
create policy "Les membres voient les membres" on public.household_members
  for select to authenticated using (private.is_member(household_id));
create policy "Les membres lisent les données" on public.records
  for select to authenticated using (private.is_member(household_id));
create policy "Les membres ajoutent des données" on public.records
  for insert to authenticated with check (private.is_member(household_id));
create policy "Les membres modifient les données" on public.records
  for update to authenticated using (private.is_member(household_id)) with check (private.is_member(household_id));

-- Créer son foyer (un compte = un foyer).
create function public.create_household(p_member_id text, p_name text default 'Notre foyer')
returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.households;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'Ce compte fait déjà partie d''un foyer';
  end if;
  insert into public.households (name) values (coalesce(nullif(trim(p_name), ''), 'Notre foyer')) returning * into h;
  insert into public.household_members (household_id, user_id, member_id) values (h.id, uid, p_member_id);
  return h;
end;
$$;

-- Rejoindre un foyer avec son code d'invitation, en tant que membre p_member_id.
create function public.join_household(p_code text, p_member_id text)
returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.households;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into h from public.households where invite_code = upper(replace(trim(p_code), '-', ''));
  if h.id is null then raise exception 'Code d''invitation inconnu'; end if;
  if exists (select 1 from public.household_members where user_id = uid and household_id <> h.id) then
    raise exception 'Ce compte fait déjà partie d''un autre foyer';
  end if;
  if exists (select 1 from public.household_members where household_id = h.id and user_id = uid) then
    return h;
  end if;
  if (select count(*) from public.household_members where household_id = h.id) >= 6 then
    raise exception 'Ce foyer est complet';
  end if;
  if exists (select 1 from public.household_members where household_id = h.id and member_id = p_member_id) then
    raise exception 'Cette personne a déjà un compte dans le foyer';
  end if;
  insert into public.household_members (household_id, user_id, member_id) values (h.id, uid, p_member_id);
  return h;
end;
$$;

revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

-- Temps réel sur les enregistrements (filtré par les politiques de lecture).
alter publication supabase_realtime add table public.records;
