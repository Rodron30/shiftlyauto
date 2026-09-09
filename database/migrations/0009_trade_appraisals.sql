-- 0009_trade_appraisals.sql
-- V2 — Trade Appraisal. Dealer enters a customer's trade-in vehicle
-- plus its estimated market value; the appraised (offer) value is
-- market_value reduced by a condition-based deduction percentage.
-- This is intentionally a standalone record (not tied to the
-- `vehicles` inventory table) since a trade-in isn't part of the
-- dealership's own inventory unless/until the trade is accepted.

create table if not exists trade_appraisals (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  vin text,
  year integer,
  make text not null,
  model text not null,
  trim text,
  mileage integer,
  condition text not null default 'GOOD',
  market_value numeric(12, 2) not null,
  deduction_percent numeric(5, 2) not null default 15,
  appraised_value numeric(12, 2) not null,
  notes text,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists trade_appraisals_dealership_id_idx
  on trade_appraisals (dealership_id);

create index if not exists trade_appraisals_created_at_idx
  on trade_appraisals (dealership_id, created_at desc);

alter table trade_appraisals
  add constraint trade_appraisals_condition_check
  check (condition in ('EXCELLENT', 'GOOD', 'FAIR', 'POOR'));

-- Row Level Security — same dealer-isolation pattern as every
-- other table (see 0003_auth_dealerships_users.sql).
alter table trade_appraisals enable row level security;

drop policy if exists trade_appraisals_select_own_dealership on trade_appraisals;
create policy trade_appraisals_select_own_dealership on trade_appraisals
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists trade_appraisals_insert_own_dealership on trade_appraisals;
create policy trade_appraisals_insert_own_dealership on trade_appraisals
  for insert with check (dealership_id = public.current_dealership_id());

drop policy if exists trade_appraisals_delete_own_dealership on trade_appraisals;
create policy trade_appraisals_delete_own_dealership on trade_appraisals
  for delete using (dealership_id = public.current_dealership_id());
