-- 0048_bcautoloan_security_and_rate_limit_hardening.sql
-- Harden BCAutoLoan public integrations and make rate limiting atomic.

-- ============================================================
-- 1. Atomic rate-limit check
-- ============================================================

create or replace function public.check_bcautoloan_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests integer default 5,
  p_window_seconds integer default 3600
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_end timestamptz;
  v_count integer;
begin
  if p_identifier is null or p_identifier = '' then
    raise exception 'rate limit identifier is required';
  end if;

  if p_endpoint is null or p_endpoint = '' then
    raise exception 'rate limit endpoint is required';
  end if;

  if p_max_requests is null or p_max_requests <= 0 then
    raise exception 'p_max_requests must be greater than 0';
  end if;

  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be greater than 0';
  end if;

  -- Serialize concurrent requests for the same identifier + endpoint.
  perform pg_advisory_xact_lock(
    hashtextextended(p_identifier || ':' || p_endpoint, 0)
  );

  delete from public.bcautoloan_rate_limits
  where window_end < v_now;

  select request_count, window_end
    into v_count, v_window_end
  from public.bcautoloan_rate_limits
  where identifier = p_identifier
    and endpoint = p_endpoint
    and window_end > v_now
  order by window_end desc
  limit 1
  for update;

  if found then
    if v_count >= p_max_requests then
      return query
      select false,
             0,
             v_window_end;
      return;
    end if;

    update public.bcautoloan_rate_limits
    set request_count = request_count + 1,
        updated_at = v_now
    where identifier = p_identifier
      and endpoint = p_endpoint
      and window_end = v_window_end;

    return query
    select true,
           greatest(p_max_requests - v_count - 1, 0),
           v_window_end;
    return;
  end if;

  v_window_end := v_now + make_interval(secs => p_window_seconds);

  insert into public.bcautoloan_rate_limits (
    identifier,
    endpoint,
    request_count,
    window_start,
    window_end
  )
  values (
    p_identifier,
    p_endpoint,
    1,
    v_now,
    v_window_end
  );

  return query
  select true,
         greatest(p_max_requests - 1, 0),
         v_window_end;
end;
$$;

revoke all on function public.check_bcautoloan_rate_limit(text, text, integer, integer)
from public, anon, authenticated;

grant execute on function public.check_bcautoloan_rate_limit(text, text, integer, integer)
to service_role;


-- ============================================================
-- 2. Prevent duplicate active rate-limit rows
-- ============================================================

-- Deduplicate existing transient rate-limit rows before creating unique index
-- Keep the newest/current row per (identifier, endpoint) based on timestamps
delete from public.bcautoloan_rate_limits
where id not in (
  select id
  from (
    select id,
           row_number() over (
             partition by identifier, endpoint
             order by updated_at desc, created_at desc, id desc
           ) as rn
    from public.bcautoloan_rate_limits
  ) ranked
  where rn = 1
);

-- Now create the unique index
create unique index if not exists
  bcautoloan_rate_limits_identifier_endpoint_unique_idx
on public.bcautoloan_rate_limits (identifier, endpoint);


-- ============================================================
-- 3. Restrict Storage policies to service_role
-- ============================================================

drop policy if exists "Service role can upload" on storage.objects;
drop policy if exists "Service role can read" on storage.objects;
drop policy if exists "Service role can delete" on storage.objects;

create policy "Service role can upload"
on storage.objects
for insert
to service_role
with check (
  bucket_id = 'bcautoloan-applications'
);

create policy "Service role can read"
on storage.objects
for select
to service_role
using (
  bucket_id = 'bcautoloan-applications'
);

create policy "Service role can delete"
on storage.objects
for delete
to service_role
using (
  bucket_id = 'bcautoloan-applications'
);


-- ============================================================
-- 4. Restrict BCAutoLoan application policies to service_role
--    for public API writes. Internal dealership policies remain.
-- ============================================================

drop policy if exists "Service role bypass RLS"
on public.pre_approval_applications;

create policy "Service role access"
on public.pre_approval_applications
for all
to service_role
using (true)
with check (true);


-- ============================================================
-- 5. Restrict rate-limit RLS policy to service_role
-- ============================================================

drop policy if exists "Service role bypass RLS"
on public.bcautoloan_rate_limits;

create policy "Service role access"
on public.bcautoloan_rate_limits
for all
to service_role
using (true)
with check (true);

