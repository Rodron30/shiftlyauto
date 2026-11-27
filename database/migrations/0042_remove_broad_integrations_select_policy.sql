-- 0042_remove_broad_integrations_select_policy.sql
-- Remove legacy dealership-wide SELECT access.
-- The restricted admin/manager SELECT policy is defined in 0041.

drop policy if exists "Users can view dealership integrations"
on public.integrations;
