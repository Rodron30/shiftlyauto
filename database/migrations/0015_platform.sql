-- 0015_platform.sql
-- V2 - Central platform administration foundation.
-- Platform administrators are separate from dealership-level users.
-- Existing dealership RLS remains the tenant boundary.

create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'PLATFORM_ADMIN'
    check (role in ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_admins_active_idx
  on platform_admins(is_active);

create table if not exists platform_audit_logs (
  id uuid primary key default gen_random_uuid(),

  actor_user_id uuid references auth.users(id) on delete set null,

  action text not null,
  target_type text,
  target_id uuid,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_actor_idx
  on platform_audit_logs(actor_user_id);

create index if not exists platform_audit_logs_target_idx
  on platform_audit_logs(target_type, target_id);

create index if not exists platform_audit_logs_created_at_idx
  on platform_audit_logs(created_at desc);

alter table platform_admins enable row level security;
alter table platform_audit_logs enable row level security;

drop policy if exists platform_admins_select_self on platform_admins;

create policy platform_admins_select_self
  on platform_admins
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and is_active = true
  );

drop policy if exists platform_audit_logs_select_admin on platform_audit_logs;

create policy platform_audit_logs_select_admin
  on platform_audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from platform_admins pa
      where pa.user_id = auth.uid()
        and pa.is_active = true
    )
  );

grant select on platform_admins to authenticated;
grant select on platform_audit_logs to authenticated;

