-- 0047_bcautoloan_rate_limiting.sql
-- Create rate limiting table for BCAutoLoan public API endpoints

create table if not exists bcautoloan_rate_limits (
  id uuid primary key default gen_random_uuid(),
  identifier text not null, -- IP address or other stable identifier
  endpoint text not null, -- 'pre-approval' or 'sell-car'
  request_count integer not null default 1,
  window_start timestamptz not null default now(),
  window_end timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists bcautoloan_rate_limits_identifier_endpoint_idx
  on bcautoloan_rate_limits (identifier, endpoint);

create index if not exists bcautoloan_rate_limits_window_end_idx
  on bcautoloan_rate_limits (window_end);

-- Create cleanup function (idempotent)
create or replace function cleanup_old_rate_limits()
returns void as $$
begin
  delete from bcautoloan_rate_limits
  where window_end < now();
end;
$$ language plpgsql;

-- Update timestamp trigger
create or replace function update_bcautoloan_rate_limits_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bcautoloan_rate_limits_updated_at_trigger
  on bcautoloan_rate_limits;

create trigger bcautoloan_rate_limits_updated_at_trigger
  before update on bcautoloan_rate_limits
  for each row
  execute function update_bcautoloan_rate_limits_updated_at();

-- Row Level Security - allow service role to bypass RLS
alter table bcautoloan_rate_limits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Service role bypass RLS'
    and schemaname = 'public'
    and tablename = 'bcautoloan_rate_limits'
  ) then
    create policy "Service role bypass RLS" on bcautoloan_rate_limits
    for all
    using (true)
    with check (true);
  end if;
end $$;

-- Grant execute permission on cleanup function
grant execute on function cleanup_old_rate_limits() to service_role;
