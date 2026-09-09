-- 0014_saas.sql
-- V2 - SaaS multi-dealership foundation.
-- Existing dealerships are the tenant boundary.
-- This migration adds SaaS plans, subscriptions, usage tracking,
-- and account lifecycle metadata without creating a duplicate tenant table.

alter table dealerships
  add column if not exists saas_status text not null default 'ACTIVE'
    check (saas_status in ('ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELED'));

alter table dealerships
  add column if not exists trial_ends_at timestamptz;

alter table dealerships
  add column if not exists saas_created_at timestamptz not null default now();

create table if not exists saas_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_price numeric(12,2) not null default 0,
  annual_price numeric(12,2) not null default 0,

  max_users integer,
  max_vehicles integer,
  max_reports_per_month integer,
  max_ai_requests_per_month integer,
  max_integrations integer,

  features jsonb not null default '{}'::jsonb,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (monthly_price >= 0),
  check (annual_price >= 0),
  check (max_users is null or max_users > 0),
  check (max_vehicles is null or max_vehicles > 0),
  check (max_reports_per_month is null or max_reports_per_month > 0),
  check (max_ai_requests_per_month is null or max_ai_requests_per_month > 0),
  check (max_integrations is null or max_integrations > 0)
);

create table if not exists saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  plan_id uuid not null references saas_plans(id),

  status text not null default 'TRIAL'
    check (status in (
      'TRIAL',
      'ACTIVE',
      'PAST_DUE',
      'PAUSED',
      'CANCELED',
      'EXPIRED'
    )),

  billing_interval text not null default 'MONTHLY'
    check (billing_interval in ('MONTHLY', 'ANNUAL')),

  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,

  trial_ends_at timestamptz,

  provider text,
  provider_customer_id text,
  provider_subscription_id text,

  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (dealership_id)
);

create index if not exists saas_subscriptions_plan_id_idx
  on saas_subscriptions(plan_id);

create index if not exists saas_subscriptions_status_idx
  on saas_subscriptions(status);

create table if not exists saas_usage (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,

  usage_month date not null,

  active_users integer not null default 0,
  vehicle_count integer not null default 0,
  reports_generated integer not null default 0,
  ai_requests integer not null default 0,
  integration_count integer not null default 0,

  api_requests integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (dealership_id, usage_month),

  check (active_users >= 0),
  check (vehicle_count >= 0),
  check (reports_generated >= 0),
  check (ai_requests >= 0),
  check (integration_count >= 0),
  check (api_requests >= 0)
);

create index if not exists saas_usage_dealership_id_idx
  on saas_usage(dealership_id);

create index if not exists saas_usage_month_idx
  on saas_usage(usage_month);

alter table saas_plans enable row level security;
alter table saas_subscriptions enable row level security;
alter table saas_usage enable row level security;

drop policy if exists saas_plans_select_authenticated on saas_plans;
create policy saas_plans_select_authenticated
  on saas_plans
  for select
  to authenticated
  using (is_active = true);

drop policy if exists saas_subscriptions_select_own_dealership on saas_subscriptions;
create policy saas_subscriptions_select_own_dealership
  on saas_subscriptions
  for select
  to authenticated
  using (
    dealership_id = public.current_dealership_id()
  );



drop policy if exists saas_usage_select_own_dealership on saas_usage;
create policy saas_usage_select_own_dealership
  on saas_usage
  for select
  to authenticated
  using (
    dealership_id = public.current_dealership_id()
  );



insert into saas_plans (
  code,
  name,
  description,
  monthly_price,
  annual_price,
  max_users,
  max_vehicles,
  max_reports_per_month,
  max_ai_requests_per_month,
  max_integrations,
  features
)
values
(
  'STARTER',
  'Starter',
  'Core dealership vehicle intelligence and reporting.',
  0,
  0,
  5,
  500,
  100,
  100,
  2,
  '{"crm":true,"reports":true,"integrations":true,"ai":true}'::jsonb
),
(
  'GROWTH',
  'Growth',
  'Expanded dealership operations with higher usage limits.',
  0,
  0,
  25,
  5000,
  1000,
  1000,
  10,
  '{"crm":true,"reports":true,"integrations":true,"ai":true,"advanced_analytics":true}'::jsonb
),
(
  'ENTERPRISE',
  'Enterprise',
  'Multi-dealership SaaS plan with high or custom limits.',
  0,
  0,
  null,
  null,
  null,
  null,
  null,
  '{"crm":true,"reports":true,"integrations":true,"ai":true,"advanced_analytics":true,"custom_limits":true,"priority_support":true}'::jsonb
)
on conflict (code) do nothing;

create or replace function public.ensure_saas_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  starter_plan_id uuid;
begin
  select id
    into starter_plan_id
    from public.saas_plans
   where code = 'STARTER'
     and is_active = true
   limit 1;

  if starter_plan_id is not null then
    insert into public.saas_subscriptions (
      dealership_id,
      plan_id,
      status,
      billing_interval,
      current_period_start
    )
    values (
      new.id,
      starter_plan_id,
      case
        when new.saas_status = 'TRIAL' then 'TRIAL'
        else 'ACTIVE'
      end,
      'MONTHLY',
      now()
    )
    on conflict (dealership_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists dealerships_create_saas_subscription
  on dealerships;

create trigger dealerships_create_saas_subscription
after insert on dealerships
for each row
execute function public.ensure_saas_subscription();

insert into saas_subscriptions (
  dealership_id,
  plan_id,
  status,
  billing_interval,
  current_period_start
)
select
  d.id,
  p.id,
  case
    when d.saas_status = 'TRIAL' then 'TRIAL'
    when d.saas_status = 'SUSPENDED' then 'PAUSED'
    when d.saas_status = 'CANCELED' then 'CANCELED'
    else 'ACTIVE'
  end,
  'MONTHLY',
  now()
from dealerships d
cross join lateral (
  select id
  from saas_plans
  where code = case
    when d.subscription_plan in ('STARTER', 'GROWTH', 'ENTERPRISE')
      then d.subscription_plan
    else 'STARTER'
  end
  and is_active = true
  limit 1
) p
on conflict (dealership_id) do nothing;

insert into saas_usage (
  dealership_id,
  usage_month
)
select
  id,
  date_trunc('month', current_date)::date
from dealerships
on conflict (dealership_id, usage_month) do nothing;

grant select on saas_plans to authenticated;
grant select on saas_subscriptions to authenticated;
grant select on saas_usage to authenticated;



