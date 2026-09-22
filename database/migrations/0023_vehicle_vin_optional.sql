-- 0023_vehicle_vin_optional.sql
-- Allow inventory vehicles to be saved before a VIN is available.
-- VIN remains required for history/report workflows.

alter table public.vehicles
  alter column vin drop not null;
