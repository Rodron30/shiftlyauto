-- 0004_public_reports.sql
-- Phase 6 — Customer Report sharing (Blueprint §23).
--
-- A customer must be able to open a shared report link with NO login at
-- all. This adds one narrow anonymous SELECT policy scoped strictly to
-- rows that already have a share_token set — draft/internal reports
-- (share_token is null) stay fully private to the dealership.
--
-- The API route that serves this (`/api/reports/[token]`) additionally
-- only ever selects the `customer_report` column (never `ai_summary`,
-- which can contain more candid internal/salesperson-only notes), so the
-- public surface is scoped both at the row level (RLS) and the column
-- level (query shape).

drop policy if exists reports_select_by_share_token on reports;
create policy reports_select_by_share_token on reports
  for select
  to anon, authenticated
  using (share_token is not null);
