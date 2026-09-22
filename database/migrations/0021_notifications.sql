-- 0021_notifications.sql
-- Notification System — dealership-scoped and user-scoped notifications with
-- read/unread state, extensible type system, and action links.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  user_id uuid references users(id) on delete cascade, -- null = dealership-wide notification
  type text not null, -- INFO, SUCCESS, WARNING, ERROR
  category text not null, -- VEHICLE, REPORT, CRM, INTEGRATION, SYSTEM, SAAS
  title text not null,
  message text not null,
  target_url text, -- optional link to related page
  metadata jsonb default '{}', -- extensible data for future use
  read_at timestamptz, -- null = unread
  created_at timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists notifications_dealership_id_idx
  on notifications (dealership_id);

create index if not exists notifications_dealership_unread_idx
  on notifications (dealership_id, read_at) where read_at is null;

create index if not exists notifications_user_unread_idx
  on notifications (user_id, read_at) where user_id is not null and read_at is null;

create index if not exists notifications_dealership_created_idx
  on notifications (dealership_id, created_at desc);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc) where user_id is not null;

-- Constraints for valid type and category values
alter table notifications
  add constraint notifications_type_check
  check (type in ('INFO', 'SUCCESS', 'WARNING', 'ERROR'));

alter table notifications
  add constraint notifications_category_check
  check (category in ('VEHICLE', 'REPORT', 'CRM', 'INTEGRATION', 'SYSTEM', 'SAAS'));

-- Row Level Security — dealership isolation with optional user scope
alter table notifications enable row level security;

-- Users can read notifications for their dealership (including user-specific ones)
drop policy if exists notifications_select_own_dealership on notifications;
create policy notifications_select_own_dealership on notifications
  for select using (
    dealership_id = public.current_dealership_id() and
    (user_id is null or user_id = auth.uid())
  );

-- System/automated processes can insert notifications (user_id null or dealership member)
drop policy if exists notifications_insert_own_dealership on notifications;
create policy notifications_insert_own_dealership on notifications
  for insert with check (
    dealership_id = public.current_dealership_id() and
    (user_id is null or user_id = auth.uid())
  );

-- Users can mark their own notifications as read, or dealership-wide notifications
drop policy if exists notifications_update_own_dealership on notifications;
create policy notifications_update_own_dealership on notifications
  for update
  using (
    dealership_id = public.current_dealership_id() and
    (user_id is null or user_id = auth.uid())
  )
  with check (
    dealership_id = public.current_dealership_id() and
    (user_id is null or user_id = auth.uid())
  );

-- Users can delete their own user-specific notifications
drop policy if exists notifications_delete_own on notifications;
create policy notifications_delete_own on notifications
  for delete using (
    dealership_id = public.current_dealership_id() and
    user_id = auth.uid()
  );
