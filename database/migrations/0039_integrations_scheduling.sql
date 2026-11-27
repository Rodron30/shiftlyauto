-- 0039_integrations_scheduling.sql
-- Add scheduling support to integrations for automatic inventory sync

-- Add scheduling fields to integrations table
alter table integrations
  add column if not exists schedule_enabled boolean not null default false,
  add column if not exists schedule_interval text check (
    schedule_interval in (
      'HOURLY',
      'DAILY',
      'WEEKLY',
      'MONTHLY'
    )
  ),
  add column if not exists schedule_day integer check (schedule_day >= 1 and schedule_day <= 7),
  add column if not exists schedule_hour integer check (schedule_hour >= 0 and schedule_hour <= 23),
  add column if not exists next_scheduled_at timestamptz;

-- Add index for scheduling queries
create index if not exists integrations_schedule_enabled_idx
  on integrations(schedule_enabled, next_scheduled_at)
  where schedule_enabled = true;

-- Add comment to document the new fields
comment on column integrations.schedule_enabled is 'Whether automatic scheduling is enabled for this integration';
comment on column integrations.schedule_interval is 'Frequency of automatic sync: HOURLY, DAILY, WEEKLY, MONTHLY';
comment on column integrations.schedule_day is 'Day of week for weekly sync (1=Monday, 7=Sunday)';
comment on column integrations.schedule_hour is 'Hour of day for daily/weekly/monthly sync (0-23)';
comment on column integrations.next_scheduled_at is 'Next scheduled execution time for automatic sync';