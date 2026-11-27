-- 0041_security_restrict_integration_reads.sql
-- Security: integration configuration and sync logs are administrative data.
-- Only dealership admins and managers may read them.

drop policy if exists integrations_select_own_dealership
  on public.integrations;

create policy integrations_select_own_dealership
on public.integrations
for select
using (
  dealership_id = public.current_dealership_id()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.dealership_id = public.current_dealership_id()
      and u.role in ('admin', 'manager')
  )
);

drop policy if exists integration_sync_logs_select_own_dealership
  on public.integration_sync_logs;

create policy integration_sync_logs_select_own_dealership
on public.integration_sync_logs
for select
using (
  dealership_id = public.current_dealership_id()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.dealership_id = public.current_dealership_id()
      and u.role in ('admin', 'manager')
  )
);
