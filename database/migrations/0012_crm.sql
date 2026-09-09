-- 0012_crm.sql
-- Shiftly Auto V2 - CRM
-- Customer records, lead/customer relationships,
-- salesperson activity, and report/customer history.

-- ============================================================
-- 1. CUSTOMER RECORDS
-- ============================================================

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),

  dealership_id uuid not null
    references dealerships(id) on delete cascade,

  name text not null,
  phone text,
  email text,
  notes text,

  created_by uuid
    references users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_dealership_id_idx
  on customers (dealership_id);

create index if not exists customers_dealership_created_idx
  on customers (dealership_id, created_at desc);

create index if not exists customers_email_idx
  on customers (email);

create index if not exists customers_phone_idx
  on customers (phone);


-- ============================================================
-- 2. CONNECT LEADS TO CUSTOMERS
-- ============================================================

alter table leads
  add column if not exists customer_id uuid
  references customers(id) on delete set null;

create index if not exists leads_customer_id_idx
  on leads (customer_id);


-- ============================================================
-- 3. PRESERVE EXISTING LEADS
-- Create a customer record for existing leads that do not yet
-- have a customer relationship.
-- ============================================================

insert into customers (
  dealership_id,
  name,
  phone,
  email,
  notes,
  created_by,
  created_at,
  updated_at
)
select
  l.dealership_id,
  l.customer_name,
  l.customer_phone,
  l.customer_email,
  l.notes,
  l.created_by,
  l.created_at,
  l.updated_at
from leads l
where l.customer_id is null
  and not exists (
    select 1
    from customers c
    where c.dealership_id = l.dealership_id
      and c.name = l.customer_name
      and coalesce(c.phone, '') = coalesce(l.customer_phone, '')
      and coalesce(c.email, '') = coalesce(l.customer_email, '')
      and c.created_by is not distinct from l.created_by
      and c.created_at = l.created_at
  );


-- Connect each existing lead to the customer record created
-- for it. Matching uses dealership + name + phone/email.
update leads l
set customer_id = c.id
from customers c
where l.customer_id is null
  and c.dealership_id = l.dealership_id
  and c.name = l.customer_name
  and coalesce(c.phone, '') = coalesce(l.customer_phone, '')
  and coalesce(c.email, '') = coalesce(l.customer_email, '')
  and c.created_by is not distinct from l.created_by
  and c.created_at = l.created_at;


-- ============================================================
-- 4. SALESPERSON ACTIVITY
-- ============================================================

create table if not exists salesperson_activities (
  id uuid primary key default gen_random_uuid(),

  dealership_id uuid not null
    references dealerships(id) on delete cascade,

  customer_id uuid
    references customers(id) on delete set null,

  lead_id uuid references leads(id) on delete set null,

  user_id uuid not null
    references users(id) on delete restrict,

  activity_type text not null
    check (
      activity_type in (
        'CALL',
        'SMS',
        'EMAIL',
        'MEETING',
        'NOTE',
        'FOLLOW_UP',
        'STATUS_CHANGE'
      )
    ),

  description text,

  activity_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists salesperson_activities_dealership_idx
  on salesperson_activities (dealership_id);

create index if not exists salesperson_activities_customer_idx
  on salesperson_activities (customer_id);

create index if not exists salesperson_activities_lead_idx
  on salesperson_activities (lead_id);

create index if not exists salesperson_activities_user_idx
  on salesperson_activities (user_id);

create index if not exists salesperson_activities_activity_at_idx
  on salesperson_activities (dealership_id, activity_at desc);


-- ============================================================
-- 5. REPORT HISTORY -> CUSTOMER / LEAD
-- Reuse the existing reports table.
-- ============================================================

alter table reports
  add column if not exists customer_id uuid
  references customers(id) on delete set null;

alter table reports
  add column if not exists lead_id uuid
  references leads(id) on delete set null;

create index if not exists reports_customer_id_idx
  on reports (customer_id);

create index if not exists reports_lead_id_idx
  on reports (lead_id);


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

alter table customers enable row level security;
alter table salesperson_activities enable row level security;


-- ============================================================
-- CUSTOMERS POLICIES
-- ============================================================

drop policy if exists customers_select_own_dealership on customers;

create policy customers_select_own_dealership
  on customers
  for select
  using (
    dealership_id = public.current_dealership_id()
  );


drop policy if exists customers_insert_own_dealership on customers;

create policy customers_insert_own_dealership
  on customers
  for insert
  with check (
    dealership_id = public.current_dealership_id()
  );


drop policy if exists customers_update_own_dealership on customers;

create policy customers_update_own_dealership
  on customers
  for update
  using (
    dealership_id = public.current_dealership_id()
  )
  with check (
    dealership_id = public.current_dealership_id()
  );


drop policy if exists customers_delete_own_dealership on customers;

create policy customers_delete_own_dealership
  on customers
  for delete
  using (
    dealership_id = public.current_dealership_id()
  );


-- ============================================================
-- SALESPERSON ACTIVITY POLICIES
-- ============================================================

drop policy if exists salesperson_activities_select_own_dealership
  on salesperson_activities;

create policy salesperson_activities_select_own_dealership
  on salesperson_activities
  for select
  using (
    dealership_id = public.current_dealership_id()
  );


drop policy if exists salesperson_activities_insert_own_dealership
  on salesperson_activities;

create policy salesperson_activities_insert_own_dealership
  on salesperson_activities
  for insert
  with check (
    dealership_id = public.current_dealership_id()
    and user_id = auth.uid()
  );


drop policy if exists salesperson_activities_update_own_dealership
  on salesperson_activities;

create policy salesperson_activities_update_own_dealership
  on salesperson_activities
  for update
  using (
    dealership_id = public.current_dealership_id()
  )
  with check (
    dealership_id = public.current_dealership_id()
  );


drop policy if exists salesperson_activities_delete_own_dealership
  on salesperson_activities;

create policy salesperson_activities_delete_own_dealership
  on salesperson_activities
  for delete
  using (
    dealership_id = public.current_dealership_id()
  );


-- ============================================================
-- 7. REPORT POLICIES FOR CRM RELATIONSHIPS
-- Existing report policies remain in place because report
-- dealership isolation is still based on the vehicle.
-- ============================================================

drop policy if exists reports_update_own_dealership on reports;

create policy reports_update_own_dealership
  on reports
  for update
  using (
    vehicle_id in (
      select id
      from vehicles
      where dealership_id = public.current_dealership_id()
    )
  )
  with check (
    vehicle_id in (
      select id
      from vehicles
      where dealership_id = public.current_dealership_id()
    )
  );


-- ============================================================
-- END CRM V2
-- ============================================================


