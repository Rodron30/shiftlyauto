-- 0043_restrict_integration_sync_log_writes.sql
-- Integration sync logs are server-managed administrative records.
-- Only dealership admins and managers may write or delete them.
-- Service-role cron operations bypass RLS as intended.

drop policy if exists integration_sync_logs_insert_own_dealership
on public.integration_sync_logs;

create policy integration_sync_logs_insert_own_dealership
on public.integration_sync_logs
for insert
with check (
  dealership_id = public.current_dealership_id()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.dealership_id = public.current_dealership_id()
      and u.role in ('admin', 'manager')
  )
);

drop policy if exists integration_sync_logs_update_own_dealership
on public.integration_sync_logs;

create policy integration_sync_logs_update_own_dealership
on public.integration_sync_logs
for update
using (
  dealership_id = public.current_dealership_id()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.dealership_id = public.current_dealership_id()
      and u.role in ('admin', 'manager')
  )
)
with check (
  dealership_id = public.current_dealership_id()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.dealership_id = public.current_dealership_id()
      and u.role in ('admin', 'manager')
  )
);

drop policy if exists integration_sync_logs_delete_own_dealership
on public.integration_sync_logs;

create policy integration_sync_logs_delete_own_dealership
on public.integration_sync_logs
for delete
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
