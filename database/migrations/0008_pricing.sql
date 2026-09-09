-- 0008_pricing.sql
-- V2 — Pricing intelligence tables backing GET /api/pricing/[vin].
-- Adds vehicle_price_analysis (computed pricing summary, one active row
-- per vehicle) and vehicle_market_listings (competitive comparables used
-- to compute it). Both carry dealership_id directly, matching the
-- `vehicles` table pattern, so the pricing route's `.eq("dealership_id", ...)`
-- filters and RLS stay consistent without an extra join.

-- ---------------------------------------------------------------------
-- vehicle_price_analysis
-- Latest computed pricing summary for a vehicle. New calculations insert
-- a new row rather than update in place, so history is preserved; the API
-- reads the most recent one via `order by calculated_at desc limit 1`.
-- ---------------------------------------------------------------------
create table if not exists vehicle_price_analysis (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  dealership_id uuid not null references dealerships(id) on delete cascade,
  low_price numeric(12, 2),
  market_price numeric(12, 2),
  high_price numeric(12, 2),
  recommended_price numeric(12, 2),
  comparable_count integer not null default 0,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_price_analysis_vehicle_id_idx
  on vehicle_price_analysis (vehicle_id);

create index if not exists vehicle_price_analysis_dealership_id_idx
  on vehicle_price_analysis (dealership_id);

-- Fast "latest analysis per vehicle" lookups.
create index if not exists vehicle_price_analysis_vehicle_calculated_idx
  on vehicle_price_analysis (vehicle_id, calculated_at desc);

-- ---------------------------------------------------------------------
-- vehicle_market_listings
-- Competitive comparable listings a pricing analysis is based on.
-- `source` identifies where a listing came from (provider name, or
-- 'manual' for a dealer-entered comparable — same manual-entry pattern
-- used for history events until a commercial data provider is wired up).
-- ---------------------------------------------------------------------
create table if not exists vehicle_market_listings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  dealership_id uuid not null references dealerships(id) on delete cascade,
  source text not null,
  source_url text,
  year integer,
  make text,
  model text,
  trim text,
  price numeric(12, 2),
  mileage integer,
  location text,
  listed_at timestamptz,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_market_listings_vehicle_id_idx
  on vehicle_market_listings (vehicle_id);

create index if not exists vehicle_market_listings_dealership_id_idx
  on vehicle_market_listings (dealership_id);

-- ---------------------------------------------------------------------
-- Row Level Security — same dealer-isolation pattern as every other
-- table (see 0003_auth_dealerships_users.sql).
-- ---------------------------------------------------------------------
alter table vehicle_price_analysis enable row level security;
alter table vehicle_market_listings enable row level security;

drop policy if exists vehicle_price_analysis_select_own_dealership on vehicle_price_analysis;
create policy vehicle_price_analysis_select_own_dealership on vehicle_price_analysis
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists vehicle_price_analysis_insert_own_dealership on vehicle_price_analysis;
create policy vehicle_price_analysis_insert_own_dealership on vehicle_price_analysis
  for insert with check (dealership_id = public.current_dealership_id());

drop policy if exists vehicle_market_listings_select_own_dealership on vehicle_market_listings;
create policy vehicle_market_listings_select_own_dealership on vehicle_market_listings
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists vehicle_market_listings_insert_own_dealership on vehicle_market_listings;
create policy vehicle_market_listings_insert_own_dealership on vehicle_market_listings
  for insert with check (dealership_id = public.current_dealership_id());

-- NOTE: this migration only creates storage. Nothing in the codebase yet
-- writes rows into these two tables (checked: app/api/pricing/[vin]/route.ts
-- is the only file that references them, and it's read-only). Until a
-- market-data provider or a manual-entry form is built, GET /api/pricing/:vin
-- will succeed but always return empty pricing/comparables — which is the
-- correct, honest behavior (same "never claim clean history with no data"
-- principle the app already applies to vehicle history).
