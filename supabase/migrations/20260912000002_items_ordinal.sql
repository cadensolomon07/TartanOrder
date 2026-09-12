-- Items keep their published menu order so a catalog loaded from the database
-- renders identically to the bundled release (deviation from the ADR table list:
-- one extra column, no semantic change).
alter table public.items add column ordinal integer not null check (ordinal > 0);
alter table public.items add constraint items_version_ordinal_unique unique (version_id, ordinal);
comment on column public.items.ordinal is 'Display order within the catalog version, 1-based.';
