-- 0006_fuel_checked_by.sql
-- Closes blueprint gaps: separate Fuel field (§9), "Checked by" +
-- duplicate-VIN messaging (§41-42).

alter table vehicles add column if not exists fuel text;
alter table vehicles add column if not exists created_by uuid references users(id);

create index if not exists vehicles_created_by_idx on vehicles (created_by);

-- vehicles already has no `updated_at` touched on re-lookup; add one so
-- "Last checked" (§41) can be meaningful once refresh logic updates it.
alter table vehicles add column if not exists updated_at timestamptz not null default now();
