-- 0040_vehicle_condition_source.sql
-- Add fields required by the current vehicle API

alter table public.vehicles
  add column if not exists condition text;

alter table public.vehicles
  add column if not exists source_url text;
