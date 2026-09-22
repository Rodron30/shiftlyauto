-- 0022_fix_role_provisioning.sql
-- Fix role assignment security bug in signup flow.
--
-- SECURITY CHANGES:
-- 1. Remove fallback logic that created users without dealership
-- 2. Fail signups without valid invite or dealership_name
-- 3. Ensure role assignment only from validated database state
-- 4. Never trust client-provided role or signup_intent metadata
--
-- PRESERVED:
-- - Existing production users and dealerships
-- - RLS policies
-- - Invite functionality
-- - Dealership owner signup flow

-- Replace the handle_new_user() trigger with secure version
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_dealership_id uuid;
  dealership_name text;
  full_name text;
  invite_token text;
  matched_invite dealership_invites%rowtype;
begin
  dealership_name := new.raw_user_meta_data ->> 'dealership_name';
  full_name := new.raw_user_meta_data ->> 'full_name';
  invite_token := new.raw_user_meta_data ->> 'invite_token';

  -- FLOW 1: Invite-based signup (validated dealership staff)
  if invite_token is not null and length(trim(invite_token)) > 0 then
    select * into matched_invite
    from dealership_invites
    where token = trim(invite_token)
      and used_at is null
      and expires_at > now()
    limit 1;

    if matched_invite.id is null then
      raise exception 'Invite is invalid or expired.';
    end if;

    if lower(trim(coalesce(new.email, ''))) <> lower(trim(matched_invite.email)) then
      raise exception 'Invite email does not match the account email.';
    end if;

    -- SECURITY: Role comes from validated database row, never client metadata
    insert into users (id, dealership_id, name, email, role)
    values (
      new.id,
      matched_invite.dealership_id,
      full_name,
      new.email,
      matched_invite.role  -- manager or salesperson only (enforced by migration 0017)
    );

    update dealership_invites
    set used_at = now()
    where id = matched_invite.id;

    return new;
  end if;

  -- FLOW 2: Dealership owner signup (creates new dealership + admin)
  if dealership_name is not null and length(trim(dealership_name)) > 0 then
    -- SECURITY: This is the ONLY way to get admin role
    -- Dealership creation is the intended public signup flow
    insert into dealerships (name)
    values (trim(dealership_name))
    returning id into new_dealership_id;

    insert into users (id, dealership_id, name, email, role)
    values (new.id, new_dealership_id, full_name, new.email, 'admin');

    return new;
  end if;

  -- FLOW 3: No valid signup path
  -- SECURITY: Do NOT create a users row for unsupported signup attempts
  -- This prevents privilege escalation through partial/invalid signups
  raise exception 'Invalid signup. Please use a dealership invite or contact support.';
end;
$$;
