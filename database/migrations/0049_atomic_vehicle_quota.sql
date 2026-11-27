-- Atomic vehicle quota enforcement.
-- Prevents concurrent vehicle creates/imports from exceeding max_vehicles.

create or replace function public.insert_vehicles_atomic(
  p_vehicles jsonb
)
returns setof public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_dealership_id uuid;
  v_role text;
  v_vehicle_limit integer;
  v_current_count integer;
  v_insert_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = 'insufficient_privilege';
  end if;

  v_dealership_id := public.current_dealership_id();

  if v_dealership_id is null then
    raise exception 'User dealership could not be determined.'
      using errcode = 'insufficient_privilege';
  end if;

  select u.role
    into v_role
  from public.users u
  where u.id = v_user_id
    and u.dealership_id = v_dealership_id
  limit 1;

  if v_role is null then
    raise exception 'User dealership access could not be verified.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_role not in ('admin', 'manager', 'salesperson') then
    raise exception 'You do not have permission to add vehicles.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_vehicles is null
     or jsonb_typeof(p_vehicles) <> 'array'
     or jsonb_array_length(p_vehicles) = 0 then
    raise exception 'At least one vehicle is required.'
      using errcode = 'invalid_parameter_value';
  end if;

  select p.max_vehicles
    into v_vehicle_limit
  from public.saas_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  join public.dealerships d on d.id = s.dealership_id
  where s.dealership_id = v_dealership_id
    and d.saas_status in ('ACTIVE', 'TRIAL')
    and s.status in ('ACTIVE', 'TRIAL')
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active vehicle plan could not be verified.'
      using errcode = 'insufficient_privilege';
  end if;

  /*
   * Serialize vehicle quota operations for this dealership.
   * The advisory transaction lock remains held through the insert.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      'vehicle-quota:' || v_dealership_id::text,
      0
    )
  );

  select count(*)
    into v_current_count
  from public.vehicles
  where dealership_id = v_dealership_id
    and archived_at is null;

  v_insert_count := jsonb_array_length(p_vehicles);

  if v_vehicle_limit is not null
     and v_current_count + v_insert_count > v_vehicle_limit then
    raise exception
      'Vehicle limit reached. Your current plan allows % active vehicles.',
      v_vehicle_limit
      using errcode = 'check_violation';
  end if;

  return query
  insert into public.vehicles (
    dealership_id,
    vin,
    year,
    make,
    model,
    trim,
    body,
    engine,
    drivetrain,
    fuel,
    price,
    description,
    status,
    primary_image,
    images,
    location,
    mileage,
    mileage_unit,
    currency,
    transmission,
    exterior_color,
    interior_color,
    has_clean_title,
    condition,
    source_url,
    created_by
  )
  select
    v_dealership_id,
    nullif(x.vin, ''),
    x.year,
    x.make,
    x.model,
    x.trim,
    x.body,
    x.engine,
    x.drivetrain,
    x.fuel,
    x.price,
    x.description,
    coalesce(nullif(x.status, ''), 'AVAILABLE'),
    x.primary_image,
    coalesce(x.images, '[]'::jsonb),
    x.location,
    x.mileage,
    x.mileage_unit,
    coalesce(nullif(x.currency, ''), 'CAD'),
    x.transmission,
    x.exterior_color,
    x.interior_color,
    x.has_clean_title,
    x.condition,
    x.source_url,
    v_user_id
  from jsonb_to_recordset(p_vehicles) as x(
    vin text,
    year integer,
    make text,
    model text,
    trim text,
    body text,
    engine text,
    drivetrain text,
    fuel text,
    price numeric,
    description text,
    status text,
    primary_image text,
    images jsonb,
    location text,
    mileage integer,
    mileage_unit text,
    currency text,
    transmission text,
    exterior_color text,
    interior_color text,
    has_clean_title boolean,
    condition text,
    source_url text
  )
  returning *;

exception
  when check_violation then
    raise;
  when unique_violation then
    raise;
end;
$$;

revoke execute
on function public.insert_vehicles_atomic(jsonb)
from public, anon, authenticated, service_role;

grant execute
on function public.insert_vehicles_atomic(jsonb)
to authenticated;

-- Row-level quota enforcement for direct inserts and reactivation.
-- Uses the same transaction advisory lock as insert_vehicles_atomic.

create or replace function public.enforce_vehicle_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_limit integer;
  v_current_count bigint;
begin
  if new.dealership_id is null then
    raise exception 'Vehicle dealership is required.'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'UPDATE' then
    if old.dealership_id = new.dealership_id
       and old.archived_at is null
       and new.archived_at is null then
      return new;
    end if;
  end if;

  if new.archived_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'vehicle-quota:' || new.dealership_id::text,
      0
    )
  );

  select p.max_vehicles
    into v_vehicle_limit
  from public.saas_subscriptions s
  join public.saas_plans p on p.id = s.plan_id
  join public.dealerships d on d.id = s.dealership_id
  where s.dealership_id = new.dealership_id
    and d.saas_status in ('ACTIVE', 'TRIAL')
    and s.status in ('ACTIVE', 'TRIAL')
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active vehicle plan could not be verified.'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'UPDATE' then
    select count(*)
      into v_current_count
    from public.vehicles v
    where v.dealership_id = new.dealership_id
      and v.archived_at is null
      and v.id <> new.id;
  else
    select count(*)
      into v_current_count
    from public.vehicles v
    where v.dealership_id = new.dealership_id
      and v.archived_at is null;
  end if;

  if v_vehicle_limit is not null
     and v_current_count >= v_vehicle_limit then
    raise exception
      'Vehicle limit reached. Your current plan allows % active vehicles.',
      v_vehicle_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists vehicles_enforce_quota
  on public.vehicles;

drop trigger if exists vehicles_enforce_quota_update
  on public.vehicles;

create trigger vehicles_enforce_quota
before insert
on public.vehicles
for each row
execute function public.enforce_vehicle_quota();

create trigger vehicles_enforce_quota_update
before update of dealership_id, archived_at
on public.vehicles
for each row
execute function public.enforce_vehicle_quota();

revoke execute on function public.enforce_vehicle_quota()
  from public, anon, authenticated;
-- Statement-level safeguards for multi-row inserts and quota-affecting updates.
-- Row triggers acquire the dealership advisory lock before changes; these
-- checks validate the final active count after the complete SQL statement.

create or replace function public.enforce_vehicle_quota_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealership_id uuid;
  v_vehicle_limit integer;
  v_current_count bigint;
begin
  for v_dealership_id in
    select distinct n.dealership_id
    from new_rows n
    where n.archived_at is null
      and n.dealership_id is not null
  loop
    select p.max_vehicles
      into v_vehicle_limit
    from public.saas_subscriptions s
    join public.saas_plans p on p.id = s.plan_id
    join public.dealerships d on d.id = s.dealership_id
    where s.dealership_id = v_dealership_id
      and d.saas_status in ('ACTIVE', 'TRIAL')
      and s.status in ('ACTIVE', 'TRIAL')
      and p.is_active = true
    limit 1;

    if not found then
      raise exception 'Active vehicle plan could not be verified.'
        using errcode = 'insufficient_privilege';
    end if;

    select count(*)
      into v_current_count
    from public.vehicles v
    where v.dealership_id = v_dealership_id
      and v.archived_at is null;

    if v_vehicle_limit is not null
       and v_current_count > v_vehicle_limit then
      raise exception
        'Vehicle limit reached. Your current plan allows % active vehicles.',
        v_vehicle_limit
        using errcode = 'check_violation';
    end if;
  end loop;

  return null;
end;
$$;

create or replace function public.enforce_vehicle_quota_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealership_id uuid;
  v_vehicle_limit integer;
  v_current_count bigint;
begin
  for v_dealership_id in
    select distinct n.dealership_id
    from new_rows n
    join old_rows o on o.id = n.id
    where n.archived_at is null
      and n.dealership_id is not null
      and (
        o.dealership_id is distinct from n.dealership_id
        or o.archived_at is distinct from n.archived_at
      )
  loop
    select p.max_vehicles
      into v_vehicle_limit
    from public.saas_subscriptions s
    join public.saas_plans p on p.id = s.plan_id
    join public.dealerships d on d.id = s.dealership_id
    where s.dealership_id = v_dealership_id
      and d.saas_status in ('ACTIVE', 'TRIAL')
      and s.status in ('ACTIVE', 'TRIAL')
      and p.is_active = true
    limit 1;

    if not found then
      raise exception 'Active vehicle plan could not be verified.'
        using errcode = 'insufficient_privilege';
    end if;

    select count(*)
      into v_current_count
    from public.vehicles v
    where v.dealership_id = v_dealership_id
      and v.archived_at is null;

    if v_vehicle_limit is not null
       and v_current_count > v_vehicle_limit then
      raise exception
        'Vehicle limit reached. Your current plan allows % active vehicles.',
        v_vehicle_limit
        using errcode = 'check_violation';
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists vehicles_quota_after_insert
  on public.vehicles;

create trigger vehicles_quota_after_insert
after insert on public.vehicles
referencing new table as new_rows
for each statement
execute function public.enforce_vehicle_quota_after_insert();

drop trigger if exists vehicles_quota_after_update
  on public.vehicles;

create trigger vehicles_quota_after_update
after update on public.vehicles
referencing old table as old_rows new table as new_rows
for each statement
execute function public.enforce_vehicle_quota_after_update();

revoke execute on function public.enforce_vehicle_quota_after_insert()
  from public, anon, authenticated;

revoke execute on function public.enforce_vehicle_quota_after_update()
  from public, anon, authenticated;