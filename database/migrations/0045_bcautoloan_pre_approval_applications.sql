-- 0045_bcautoloan_pre_approval_applications.sql
-- BCAutoLoan - Pre-Approval Applications Table
-- Stores pre-approval applications submitted through the BCAutoLoan public website

create table if not exists pre_approval_applications (
  id uuid primary key default gen_random_uuid(),

  -- Application identifier
  application_number text not null unique,

  -- Dealership relationship (optional, for CRM integration)
  dealership_id uuid references dealerships(id) on delete set null,

  -- CRM relationships
  customer_id uuid references customers(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,

  -- Personal Information
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,

  -- Address Information
  address text not null,
  city text not null,
  province text not null,
  postal_code text not null,

  -- Employment / Income Information
  employment_status text not null,
  employer text not null,
  job_title text not null,
  income text not null,
  income_frequency text not null,

  -- Vehicle / Financing Interest
  vehicle_type text not null,
  vehicle_make text not null,
  vehicle_model text not null,
  vehicle_budget text not null,
  down_payment text not null,
  has_trade boolean not null default false,

  -- Full application data (JSONB for flexibility and future integration)
  application_data jsonb not null default '{}'::jsonb,

  -- PDF reference (if generated)
  pdf_path text,
  pdf_generated_at timestamptz,

  -- Source tracking
  source text not null default 'BCAutoLoan',
  source_metadata jsonb not null default '{}'::jsonb,

  -- Application status
  status text not null default 'SUBMITTED',

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists pre_approval_applications_application_number_idx
  on pre_approval_applications (application_number);

create index if not exists pre_approval_applications_dealership_id_idx
  on pre_approval_applications (dealership_id);

create index if not exists pre_approval_applications_customer_id_idx
  on pre_approval_applications (customer_id);

create index if not exists pre_approval_applications_lead_id_idx
  on pre_approval_applications (lead_id);

create index if not exists pre_approval_applications_email_idx
  on pre_approval_applications (email);

create index if not exists pre_approval_applications_phone_idx
  on pre_approval_applications (phone);

create index if not exists pre_approval_applications_status_idx
  on pre_approval_applications (status);

create index if not exists pre_approval_applications_created_at_idx
  on pre_approval_applications (created_at desc);

-- Status constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pre_approval_applications_status_check'
    and conrelid = 'public.pre_approval_applications'::regclass
  ) then
    alter table pre_approval_applications
    add constraint pre_approval_applications_status_check
    check (status in ('SUBMITTED', 'RECEIVED', 'HANDED_OFF', 'COMPLETED', 'CANCELLED'));
  end if;
end $$;

-- Update timestamp trigger
create or replace function update_pre_approval_applications_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists pre_approval_applications_updated_at_trigger
  on pre_approval_applications;

create trigger pre_approval_applications_updated_at_trigger
  before update on pre_approval_applications
  for each row
  execute function update_pre_approval_applications_updated_at();

-- Row Level Security
-- Note: BCAutoLoan public API will use service-role key to bypass RLS
-- These policies are for internal dashboard access if needed
alter table pre_approval_applications enable row level security;

-- Allow service role to bypass RLS (for public API)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Service role bypass RLS'
    and schemaname = 'public'
    and tablename = 'pre_approval_applications'
  ) then
    create policy "Service role bypass RLS" on pre_approval_applications
    for all
    using (true)
    with check (true);
  end if;
end $$;

-- Dealership isolation for internal dashboard access
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Dealership can view own applications'
    and schemaname = 'public'
    and tablename = 'pre_approval_applications'
  ) then
    create policy "Dealership can view own applications" on pre_approval_applications
    for select
    using (dealership_id = public.current_dealership_id());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Dealership can insert own applications'
    and schemaname = 'public'
    and tablename = 'pre_approval_applications'
  ) then
    create policy "Dealership can insert own applications" on pre_approval_applications
    for insert
    with check (dealership_id = public.current_dealership_id());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Dealership can update own applications'
    and schemaname = 'public'
    and tablename = 'pre_approval_applications'
  ) then
    create policy "Dealership can update own applications" on pre_approval_applications
    for update
    using (dealership_id = public.current_dealership_id())
    with check (dealership_id = public.current_dealership_id());
  end if;
end $$;
