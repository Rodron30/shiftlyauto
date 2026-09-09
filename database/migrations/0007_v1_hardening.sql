-- 0007_v1_hardening.sql
-- Final V1 hardening: allow a dealership member to refresh the saved
-- vehicle's last-checked timestamp while keeping dealer isolation intact.

alter table vehicles enable row level security;

drop policy if exists vehicles_update_own_dealership on vehicles;
create policy vehicles_update_own_dealership on vehicles
  for update
  using (dealership_id = public.current_dealership_id())
  with check (dealership_id = public.current_dealership_id());
