-- 0033_security_policy_cleanup.sql
-- Remove legacy permissive RLS policies that bypass
-- the customer-role restrictions introduced by 0027/0032.

begin;

-- ============================================================
-- CUSTOMERS
-- ============================================================

-- Remove legacy dealership-wide policies.
-- The final customer permissions are provided by 0032.
drop policy if exists "Users can view dealership customers" on customers;
drop policy if exists "Users can create dealership customers" on customers;
drop policy if exists "Users can update dealership customers" on customers;
drop policy if exists "Users can delete dealership customers" on customers;

-- ============================================================
-- REPORTS
-- ============================================================

-- Remove legacy dealership-wide policies.
-- The final report permissions are provided by 0032.
drop policy if exists "Users can create reports for their dealership vehicles" on reports;
drop policy if exists "Users can view their dealership reports" on reports;
drop policy if exists "Users can revoke shared reports for their dealership" on reports;
drop policy if exists "Public can view shared reports" on reports;

-- Replace the 0032 shared-report policy with an expiry-aware version.
drop policy if exists reports_select_by_share_token on reports;

create policy reports_select_by_share_token
  on reports
  for select
  to anon, authenticated
  using (
    share_token is not null
    and (
      expires_at is null
      or expires_at > now()
    )
  );

commit;
