-- TartanOrder: released catalog versions and simulated orders.
-- See docs/adr-supabase-persistence.md. Catalog rows are immutable once
-- published; a price change is a new catalog version. Applied to the
-- TartanHacks project through the Supabase MCP apply_migration.

create table public.catalog_versions (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_.-]{0,99}$'),
  source_snapshot jsonb not null,
  published_at timestamptz not null default now(),
  is_active boolean not null default false
);
comment on table public.catalog_versions is 'One row per released menu version. Immutable except is_active; at most one row is active.';
create unique index catalog_versions_one_active on public.catalog_versions (is_active) where is_active;

create table public.locations (
  version_id text not null references public.catalog_versions (id),
  id text not null check (id ~ '^[a-z0-9]{1,20}$'),
  name text not null check (length(name) between 1 and 200),
  location text not null check (length(location) <= 300),
  menu_url text check (menu_url is null or length(menu_url) between 1 and 1000),
  directory_menu_url text check (directory_menu_url is null or length(directory_menu_url) between 1 and 1000),
  detail_url text check (detail_url is null or length(detail_url) between 1 and 1000),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  source_note text check (source_note is null or length(source_note) <= 500),
  active_rank integer check (active_rank is null or active_rank > 0),
  primary key (version_id, id),
  unique (version_id, active_rank)
);
comment on table public.locations is 'Dining directory rows per catalog version. active_rank 1..n is the public shortlist order; null means archived.';

create table public.modifiers (
  version_id text not null references public.catalog_versions (id),
  id text not null check (id ~ '^[a-z0-9_]{1,40}$'),
  label text not null check (length(label) between 1 and 200),
  price_cents integer not null check (price_cents >= 0),
  primary key (version_id, id)
);
comment on table public.modifiers is 'Order modifiers per catalog version, integer cents.';

create table public.items (
  version_id text not null references public.catalog_versions (id),
  id text not null check (id ~ '^[a-z0-9][a-z0-9_-]{0,99}$'),
  location_id text not null,
  label text not null check (length(label) between 1 and 200),
  category text not null check (category in ('mains', 'sides', 'drinks')),
  description text not null check (length(description) <= 1000),
  price_cents integer not null check (price_cents >= 0),
  aliases text[] not null default '{}',
  allowed_modifiers text[] not null default '{}',
  source_page integer check (source_page is null or source_page > 0),
  primary key (version_id, id),
  foreign key (version_id, location_id) references public.locations (version_id, id)
);
comment on table public.items is 'Priced, orderable configurations per catalog version. Prices are published snapshot cents, not live register prices.';

create table public.menu_previews (
  version_id text not null references public.catalog_versions (id),
  location_id text not null,
  ordinal integer not null check (ordinal > 0),
  label text not null check (length(label) between 1 and 200),
  description text not null check (length(description) <= 1000),
  price_cents integer check (price_cents is null or price_cents >= 0),
  source_url text check (source_url is null or length(source_url) between 1 and 1000),
  source_page integer check (source_page is null or source_page > 0),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  primary key (version_id, location_id, ordinal),
  foreign key (version_id, location_id) references public.locations (version_id, id)
);
comment on table public.menu_previews is 'Menu entries shown as unavailable previews because no complete price is verified.';

create table public.sessions (
  id text primary key check (length(id) between 1 and 100),
  catalog_version_id text not null references public.catalog_versions (id),
  wait_config jsonb,
  allowed_location_ids text[],
  created_at timestamptz not null default now()
);
comment on table public.sessions is 'One simulated ordering session per kiosk visit, pinned to the catalog version it ran against.';

create table public.audit_events (
  session_id text not null references public.sessions (id) on delete cascade,
  seq integer not null check (seq > 0),
  event jsonb not null,
  outcome text not null check (outcome in ('applied', 'clarify', 'rejected', 'ignored')),
  code text check (code is null or length(code) between 1 and 60),
  recorded_at timestamptz not null default now(),
  primary key (session_id, seq)
);
comment on table public.audit_events is 'Append-only engine audit entries; replaying them against the same catalog version reconstructs the order.';

create table public.receipts (
  id text primary key check (length(id) between 1 and 100),
  session_id text not null references public.sessions (id) on delete cascade,
  review_id text not null check (length(review_id) between 1 and 100),
  lines jsonb not null,
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);
comment on table public.receipts is 'Simulated tickets. No purchase, payment, POS call or kitchen dispatch.';

-- Row Level Security: catalog tables are public read; order tables have no policies,
-- so only the server-side secret key can read or write them.
alter table public.catalog_versions enable row level security;
alter table public.locations enable row level security;
alter table public.modifiers enable row level security;
alter table public.items enable row level security;
alter table public.menu_previews enable row level security;
alter table public.sessions enable row level security;
alter table public.audit_events enable row level security;
alter table public.receipts enable row level security;

create policy "catalog_versions are public" on public.catalog_versions for select to anon, authenticated using (true);
create policy "locations are public" on public.locations for select to anon, authenticated using (true);
create policy "modifiers are public" on public.modifiers for select to anon, authenticated using (true);
create policy "items are public" on public.items for select to anon, authenticated using (true);
create policy "menu_previews are public" on public.menu_previews for select to anon, authenticated using (true);

-- Immutability: published catalog rows can never be updated or deleted, for any role.
create function public.catalog_rows_are_immutable() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'catalog rows are immutable; publish a new catalog version instead (table %, version %)',
    tg_table_name, coalesce(old.version_id, '?')
    using errcode = 'P0001';
end
$$;
comment on function public.catalog_rows_are_immutable() is 'Raises on any UPDATE or DELETE of a released catalog row.';

create trigger locations_immutable before update or delete on public.locations
  for each row execute function public.catalog_rows_are_immutable();
create trigger modifiers_immutable before update or delete on public.modifiers
  for each row execute function public.catalog_rows_are_immutable();
create trigger items_immutable before update or delete on public.items
  for each row execute function public.catalog_rows_are_immutable();
create trigger menu_previews_immutable before update or delete on public.menu_previews
  for each row execute function public.catalog_rows_are_immutable();

create function public.catalog_versions_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'catalog versions cannot be deleted (version %)', old.id using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id
     or new.source_snapshot is distinct from old.source_snapshot
     or new.published_at is distinct from old.published_at then
    raise exception 'catalog versions are immutable except is_active (version %)', old.id using errcode = 'P0001';
  end if;
  return new;
end
$$;
comment on function public.catalog_versions_guard() is 'Allows only the is_active flag of a catalog version to change; forbids delete.';

create trigger catalog_versions_guard before update or delete on public.catalog_versions
  for each row execute function public.catalog_versions_guard();
