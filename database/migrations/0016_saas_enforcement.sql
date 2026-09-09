-- 0016_saas_enforcement.sql
-- V2 SaaS entitlement enforcement.
-- Source-only migration for now; do not execute until V2 implementation is complete.

-- ---------------------------------------------------------------------
-- Helper: determine whether a dealership is allowed to use protected
-- SaaS functionality.
-- ---------------------------------------------------------------------

create or replace function public.saas_dealership_is_active(
  p_dealership_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from dealerships d
    join saas_subscriptions s
      on s.dealership_id = d.id
    where d.id = p_dealership_id
      and d.saas_status in ('ACTIVE', 'TRIAL')
      and s.status in ('ACTIVE', 'TRIAL')
  );
$$;

-- ---------------------------------------------------------------------
-- Helper: return the effective plan limit for a dealership.
-- NULL means unlimited.
-- ---------------------------------------------------------------------

create or replace function public.saas_dealership_limit(
  p_dealership_id uuid,
  p_limit_name text
)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select case p_limit_name
    when 'users' then p.max_users
    when 'vehicles' then p.max_vehicles
    when 'reports' then p.max_reports_per_month
    when 'ai_requests' then p.max_ai_requests_per_month
    when 'integrations' then p.max_integrations
    else null
  end
  from saas_subscriptions s
  join saas_plans p
    on p.id = s.plan_id
  join dealerships d
    on d.id = s.dealership_id
  where s.dealership_id = p_dealership_id
    and d.saas_status in ('ACTIVE', 'TRIAL')
    and s.status in ('ACTIVE', 'TRIAL')
    and p.is_active = true
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Enforce the effective max_users limit at the database level.
--
-- This protects both:
--   1. normal user creation
--   2. invite-based user creation
--
-- dealership_id IS NULL is intentionally allowed because the existing
-- signup flow supports a profile without a dealership.
-- ---------------------------------------------------------------------

create or replace function public.enforce_saas_user_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_limit integer;
  current_user_count integer;
begin
  -- Preserve the existing behavior for users that do not belong to a
  -- dealership yet.
  if new.dealership_id is null then
    return new;
  end if;

  -- Serialize user creation for this dealership so concurrent inserts
  -- cannot both pass the same COUNT(*) check.
  perform pg_advisory_xact_lock(
    hashtextextended(new.dealership_id::text, 0)
  );

  -- Only enforce limits for an active/trial SaaS subscription.
  -- Inactive/suspended dealerships are handled separately by the
  -- application-level SaaS status guard.
  user_limit := public.saas_dealership_limit(
    new.dealership_id,
    'users'
  );

  -- NULL means unlimited.
  if user_limit is null then
    return new;
  end if;

  select count(*)
    into current_user_count
    from public.users
   where dealership_id = new.dealership_id;

  if current_user_count >= user_limit then
    raise exception
      'SaaS user limit reached for this dealership. Maximum allowed users: %.',
      user_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists users_enforce_saas_user_limit
  on public.users;

create trigger users_enforce_saas_user_limit
before insert on public.users
for each row
execute function public.enforce_saas_user_limit();
-- ---------------------------------------------------------------------
-- Atomic monthly SaaS usage reservation.
--
-- Supported usage keys:
--   reports -> saas_usage.reports_generated
--   ai_requests -> saas_usage.ai_requests
--
-- Returns TRUE when the requested usage is reserved successfully.
-- Returns FALSE when the monthly plan limit has already been reached.
--
-- NULL plan limits mean unlimited.
-- ---------------------------------------------------------------------

create or replace function public.saas_reserve_usage(
  p_dealership_id uuid,
  p_usage_key text,
  p_amount integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_month date;
  usage_limit integer;
  current_usage integer;
begin
  if p_dealership_id is null then
    raise exception
      'SaaS usage reservation requires a dealership.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_amount <= 0 then
    raise exception
      'SaaS usage reservation amount must be greater than zero.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_usage_key not in ('reports', 'ai_requests') then
    raise exception
      'Unsupported SaaS usage key: %.',
      p_usage_key
      using errcode = 'invalid_parameter_value';
  end if;

  v_usage_month := date_trunc('month', current_date)::date;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_dealership_id::text || ':' || v_usage_month::text,
      0
    )
  );

  usage_limit := public.saas_dealership_limit(
    p_dealership_id,
    p_usage_key
  );

  if usage_limit is null then
    insert into public.saas_usage (
      dealership_id,
      usage_month
    )
    values (
      p_dealership_id,
      v_usage_month
    )
    on conflict (dealership_id, usage_month) do nothing;

    if p_usage_key = 'reports' then
      update public.saas_usage as su
         set reports_generated = su.reports_generated + p_amount,
             updated_at = now()
       where su.dealership_id = p_dealership_id
         and su.usage_month = v_usage_month;
    else
      update public.saas_usage as su
         set ai_requests = su.ai_requests + p_amount,
             updated_at = now()
       where su.dealership_id = p_dealership_id
         and su.usage_month = v_usage_month;
    end if;

    return true;
  end if;

  insert into public.saas_usage (
    dealership_id,
    usage_month
  )
  values (
    p_dealership_id,
    v_usage_month
  )
  on conflict (dealership_id, usage_month) do nothing;

  if p_usage_key = 'reports' then
    select reports_generated
      into current_usage
      from public.saas_usage as su
     where su.dealership_id = p_dealership_id
       and su.usage_month = v_usage_month
     for update;
  else
    select ai_requests
      into current_usage
      from public.saas_usage as su
     where su.dealership_id = p_dealership_id
       and su.usage_month = v_usage_month
     for update;
  end if;

  if current_usage + p_amount > usage_limit then
    return false;
  end if;

  if p_usage_key = 'reports' then
    update public.saas_usage as su
       set reports_generated = su.reports_generated + p_amount,
           updated_at = now()
     where su.dealership_id = p_dealership_id
       and su.usage_month = v_usage_month;
  else
    update public.saas_usage as su
       set ai_requests = su.ai_requests + p_amount,
           updated_at = now()
     where su.dealership_id = p_dealership_id
       and su.usage_month = v_usage_month;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Release a previously reserved monthly SaaS usage amount.
--
-- This is used when an operation reserves quota but subsequently fails.
-- ---------------------------------------------------------------------

create or replace function public.saas_release_usage(
  p_dealership_id uuid,
  p_usage_key text,
  p_amount integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_month date;
begin
  if p_dealership_id is null then
    raise exception
      'SaaS usage release requires a dealership.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_amount <= 0 then
    raise exception
      'SaaS usage release amount must be greater than zero.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_usage_key not in ('reports', 'ai_requests') then
    raise exception
      'Unsupported SaaS usage key: %.',
      p_usage_key
      using errcode = 'invalid_parameter_value';
  end if;

  v_usage_month := date_trunc('month', current_date)::date;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_dealership_id::text || ':' || v_usage_month::text,
      0
    )
  );

  if p_usage_key = 'reports' then
    update public.saas_usage as su
       set reports_generated = greatest(
         0,
         su.reports_generated - p_amount
       ),
           updated_at = now()
     where su.dealership_id = p_dealership_id
       and su.usage_month = v_usage_month;
  else
    update public.saas_usage as su
       set ai_requests = greatest(
         0,
         su.ai_requests - p_amount
       ),
           updated_at = now()
     where su.dealership_id = p_dealership_id
       and su.usage_month = v_usage_month;
  end if;
end;
$$;




