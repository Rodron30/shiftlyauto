-- 0035_integrations_delete_role_policy.sql
-- Security: only dealership admins and managers may delete integrations.

drop policy if exists integrations_delete_own_dealership
on public.integrations;

create policy integrations_delete_own_dealership
on public.integrations
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
