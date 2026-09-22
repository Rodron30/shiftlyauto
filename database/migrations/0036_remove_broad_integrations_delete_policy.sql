-- 0036_remove_broad_integrations_delete_policy.sql
-- Security: remove the legacy broad integrations DELETE policy.
-- DELETE remains allowed only through integrations_delete_own_dealership,
-- which is restricted to dealership admins and managers.

drop policy if exists "Users can delete dealership integrations"
on public.integrations;
