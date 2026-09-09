-- 0010_leads.sql
-- V2 — CRM / Lead Tracking. A customer lead may reference a specific
-- inventory vehicle (vehicle_id) or just describe general interest
-- in free text (interest_note) when no specific VIN applies yet.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  interest_note text,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  budget numeric(12, 2),
  financing_preference text,
  status text not null default 'NEW',
  follow_up_date date,
  notes text,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_dealership_id_idx
  on leads (dealership_id);

create index if not exists leads_dealership_status_idx
  on leads (dealership_id, status);

create index if not exists leads_dealership_created_idx
  on leads (dealership_id, created_at desc);

create index if not exists leads_vehicle_id_idx
  on leads (vehicle_id);

alter table leads
  add constraint leads_status_check
  check (status in ('NEW', 'CONTACTED', 'NEGOTIATING', 'WON', 'LOST'));

-- Row Level Security — same dealer-isolation pattern as every
-- other table (see 0003_auth_dealerships_users.sql).
alter table leads enable row level security;

drop policy if exists leads_select_own_dealership on leads;
create policy leads_select_own_dealership on leads
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists leads_insert_own_dealership on leads;
create policy leads_insert_own_dealership on leads
  for insert with check (dealership_id = public.current_dealership_id());

drop policy if exists leads_update_own_dealership on leads;
create policy leads_update_own_dealership on leads
  for update
  using (dealership_id = public.current_dealership_id())
  with check (dealership_id = public.current_dealership_id());

drop policy if exists leads_delete_own_dealership on leads;
create policy leads_delete_own_dealership on leads
  for delete using (dealership_id = public.current_dealership_id());
