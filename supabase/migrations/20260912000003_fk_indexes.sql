-- Covering indexes for the three foreign keys the Supabase performance advisor
-- reported as unindexed (2026-09-12). Pure additions; no data or policy change.
create index if not exists items_version_location_idx on public.items (version_id, location_id);
create index if not exists receipts_session_idx on public.receipts (session_id);
create index if not exists sessions_catalog_version_idx on public.sessions (catalog_version_id);
