-- 0002_history_reports_ai.sql
-- Adds vehicle-history, reports, and AI-audit tables per V1 Blueprint sections 30-32.
-- Run this in the Supabase SQL editor (or via the Supabase CLI) after the
-- initial `dealerships` / `users` / `vehicles` tables already exist.

-- ---------------------------------------------------------------------
-- history_events
-- Raw + normalized vehicle-history records (theft, odometer only in V1).
-- ---------------------------------------------------------------------
create table if not exists history_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  event_date date,
  event_type text not null check (event_type in ('THEFT', 'ODOMETER', 'OTHER')),
  description text,
  location text,
  odometer integer,
  source text not null,
  raw_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists history_events_vehicle_id_idx
  on history_events (vehicle_id);

create index if not exists history_events_event_type_idx
  on history_events (event_type);

-- ---------------------------------------------------------------------
-- reports
-- One row per generated report. A vehicle can have many reports.
-- ---------------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  created_by uuid references users(id),
  ai_summary jsonb,
  customer_report jsonb,
  source_information jsonb,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_vehicle_id_idx
  on reports (vehicle_id);

create unique index if not exists reports_share_token_idx
  on reports (share_token)
  where share_token is not null;

-- ---------------------------------------------------------------------
-- ai_analysis
-- Audit trail of every AI call: what went in, what came out, which model.
-- ---------------------------------------------------------------------
create table if not exists ai_analysis (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  report_id uuid references reports(id) on delete set null,
  input_data jsonb not null,
  ai_output jsonb,
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_analysis_vehicle_id_idx
  on ai_analysis (vehicle_id);
