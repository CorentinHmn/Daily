-- Réglages partagés par le foyer (icônes des onglets…) : une ligne `prefs` dans `records`.
alter table public.records drop constraint records_collection_check;
alter table public.records add constraint records_collection_check
  check (collection in ('members', 'tasks', 'routines', 'weeks', 'programs', 'sessions', 'runs', 'goals', 'habits', 'lists', 'items', 'frequent', 'prefs'));
