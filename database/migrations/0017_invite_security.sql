-- 0017_invite_security.sql
-- Harden dealership invites:
-- Invite roles must never include admin.
-- Admin remains a valid role for existing dealership users.

alter table public.dealership_invites
  drop constraint if exists dealership_invites_role_check;

alter table public.dealership_invites
  add constraint dealership_invites_role_check
  check (role in ('manager', 'salesperson'));

drop policy if exists dealership_invites_insert_own on public.dealership_invites;

create policy dealership_invites_insert_own
  on public.dealership_invites
  for insert
  with check (
    dealership_id = public.current_dealership_id()
    and role in ('manager', 'salesperson')
  );
