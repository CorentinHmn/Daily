-- Sessions de courses (une liste de base + des articles pour cette fois, chronométrées, gardées en historique) :
-- une ligne `trips` par session, une ligne `tripitems` par article (deux personnes cochent sans s'écraser).
alter table public.records drop constraint records_collection_check;
alter table public.records add constraint records_collection_check
  check (collection in ('members', 'tasks', 'routines', 'weeks', 'programs', 'sessions', 'runs', 'goals', 'habits', 'lists', 'items', 'trips', 'tripitems', 'frequent', 'prefs'));
