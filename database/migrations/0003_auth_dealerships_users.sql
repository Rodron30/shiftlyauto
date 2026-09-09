-- 0003_auth_dealerships_users.sql
-- Phase 2 — Authentication & dealer account structure (Blueprint §4-§5, §44).
-- Safe to run even if `dealerships` / `users` already exist from Phase 1.

-- ---------------------------------------------------------------------
-- Core tables (created only if they don't already exist)
-- ---------------------------------------------------------------------
create table if not exists dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  subscription_plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `users` here is the app-level profile table, one row per auth.users
-- row, carrying the dealership_id + role that RLS reads on every request.
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  dealership_id uuid references dealerships(id) on delete cascade,
  name text,
  email text,
  role text not null default 'salesperson'
    check (role in ('admin', 'manager', 'salesperson')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_dealership_id_idx
  on users (dealership_id);

-- ---------------------------------------------------------------------
-- Helper: current signed-in user's dealership_id.
-- SECURITY DEFINER so it can read `users` even while RLS is enabled on it
-- (otherwise policies on other tables that call this would recurse).
-- ---------------------------------------------------------------------
create or replace function public.current_dealership_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select dealership_id from users where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Auto-provision a dealership + profile row when someone signs up.
-- Client passes { dealership_name, full_name } in signUp() options.data.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_dealership_id uuid;
  dealership_name text;
  full_name text;
begin
  dealership_name := new.raw_user_meta_data ->> 'dealership_name';
  full_name := new.raw_user_meta_data ->> 'full_name';

  if dealership_name is not null and length(trim(dealership_name)) > 0 then
    insert into dealerships (name)
    values (trim(dealership_name))
    returning id into new_dealership_id;

    insert into users (id, dealership_id, name, email, role)
    values (new.id, new_dealership_id, full_name, new.email, 'admin');
  else
    -- No dealership name supplied (e.g. an invited teammate in a future
    -- flow). Create a profile with no dealership yet rather than failing
    -- the signup outright.
    insert into users (id, dealership_id, name, email, role)
    values (new.id, null, full_name, new.email, 'salesperson');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- Row Level Security — dealer-level data isolation (Blueprint §5, §44).
-- ---------------------------------------------------------------------
alter table dealerships enable row level security;
alter table users enable row level security;
alter table vehicles enable row level security;
alter table history_events enable row level security;
alter table reports enable row level security;
alter table ai_analysis enable row level security;

drop policy if exists dealerships_select_own on dealerships;
create policy dealerships_select_own on dealerships
  for select using (id = public.current_dealership_id());

drop policy if exists dealerships_update_own on dealerships;
create policy dealerships_update_own on dealerships
  for update using (id = public.current_dealership_id());

drop policy if exists users_select_same_dealership on users;
create policy users_select_same_dealership on users
  for select using (
    id = auth.uid() or dealership_id = public.current_dealership_id()
  );

drop policy if exists vehicles_select_own_dealership on vehicles;
create policy vehicles_select_own_dealership on vehicles
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists vehicles_insert_own_dealership on vehicles;
create policy vehicles_insert_own_dealership on vehicles
  for insert with check (dealership_id = public.current_dealership_id());

drop policy if exists history_events_select_own_dealership on history_events;
create policy history_events_select_own_dealership on history_events
  for select using (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
  );

drop policy if exists history_events_insert_own_dealership on history_events;
create policy history_events_insert_own_dealership on history_events
  for insert with check (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
  );

drop policy if exists reports_select_own_dealership on reports;
create policy reports_select_own_dealership on reports
  for select using (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
  );

drop policy if exists reports_insert_own_dealership on reports;
create policy reports_insert_own_dealership on reports
  for insert with check (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
  );

drop policy if exists ai_analysis_select_own_dealership on ai_analysis;
create policy ai_analysis_select_own_dealership on ai_analysis
  for select using (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
  );

drop policy if exists ai_analysis_insert_own_dealership on ai_analysis;
create policy ai_analysis_insert_own_dealership on ai_analysis
  for insert with check (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
  );

-- NOTE: shared report links (Blueprint §23, a future phase) need to be
-- readable by a customer with no login at all. When that's built, add a
-- narrow policy such as:
--   create policy reports_select_by_share_token on reports
--     for select using (share_token is not null);
-- and only ever expose that row through a route that looks up by token.
