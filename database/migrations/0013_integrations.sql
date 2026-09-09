-- 0013_integrations.sql
-- V2 - External integrations foundation.
-- Supports DMS, CRM, inventory platforms, dealer websites,
-- and accounting providers.

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  integration_type text not null check (
    integration_type in (
      'DMS',
      'CRM',
      'INVENTORY',
      'DEALER_WEBSITE',
      'ACCOUNTING'
    )
  ),
  provider text not null,
  name text not null,
  status text not null default 'DISCONNECTED' check (
    status in (
      'DISCONNECTED',
      'CONNECTED',
      'SYNCING',
      'ERROR',
      'DISABLED'
    )
  ),
  sync_direction text not null default 'TWO_WAY' check (
    sync_direction in (
      'IMPORT',
      'EXPORT',
      'TWO_WAY'
    )
  ),
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integrations_dealership_id_idx
  on integrations(dealership_id);

create index if not exists integrations_type_idx
  on integrations(integration_type);

create index if not exists integrations_status_idx
  on integrations(status);

create unique index if not exists integrations_dealership_provider_name_idx
  on integrations(dealership_id, integration_type, provider, name);


create table if not exists integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(id) on delete cascade,
  dealership_id uuid not null references dealerships(id) on delete cascade,
  sync_type text not null check (
    sync_type in (
      'IMPORT',
      'EXPORT',
      'TWO_WAY',
      'MANUAL',
      'SCHEDULED'
    )
  ),
  status text not null check (
    status in (
      'STARTED',
      'SUCCESS',
      'PARTIAL',
      'FAILED'
    )
  ),
  records_processed integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_failed integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists integration_sync_logs_integration_idx
  on integration_sync_logs(integration_id);

create index if not exists integration_sync_logs_dealership_idx
  on integration_sync_logs(dealership_id);

create index if not exists integration_sync_logs_created_at_idx
  on integration_sync_logs(created_at desc);


alter table integrations enable row level security;

alter table integration_sync_logs enable row level security;


drop policy if exists integrations_select_own_dealership
  on integrations;

create policy integrations_select_own_dealership
on integrations
for select
using (
  dealership_id = public.current_dealership_id()
);


drop policy if exists integrations_insert_own_dealership
  on integrations;

create policy integrations_insert_own_dealership
on integrations
for insert
with check (
  dealership_id = public.current_dealership_id()
);


drop policy if exists integrations_update_own_dealership
  on integrations;

create policy integrations_update_own_dealership
on integrations
for update
using (
  dealership_id = public.current_dealership_id()
)
with check (
  dealership_id = public.current_dealership_id()
);


drop policy if exists integrations_delete_own_dealership
  on integrations;

create policy integrations_delete_own_dealership
on integrations
for delete
using (
  dealership_id = public.current_dealership_id()
);


drop policy if exists integration_sync_logs_select_own_dealership
  on integration_sync_logs;

create policy integration_sync_logs_select_own_dealership
on integration_sync_logs
for select
using (
  dealership_id = public.current_dealership_id()
);


drop policy if exists integration_sync_logs_insert_own_dealership
  on integration_sync_logs;

create policy integration_sync_logs_insert_own_dealership
on integration_sync_logs
for insert
with check (
  dealership_id = public.current_dealership_id()
);


drop policy if exists integration_sync_logs_update_own_dealership
  on integration_sync_logs;

create policy integration_sync_logs_update_own_dealership
on integration_sync_logs
for update
using (
  dealership_id = public.current_dealership_id()
)
with check (
  dealership_id = public.current_dealership_id()
);


drop policy if exists integration_sync_logs_delete_own_dealership
  on integration_sync_logs;

create policy integration_sync_logs_delete_own_dealership
on integration_sync_logs
for delete
using (
  dealership_id = public.current_dealership_id()
);

-- END INTEGRATIONS V2
