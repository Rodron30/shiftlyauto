-- 0031_customer_invitations.sql
-- Add customer invitation system for admin-generated customer accounts
-- This replaces the public dealership signup code flow with admin-controlled invitations

-- Step 1: Create customer_invites table
create table if not exists customer_invites (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  customer_name text not null,
  email text not null,
  token text not null unique,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz
);

-- Step 2: Create indexes for performance
create index if not exists customer_invites_dealership_id_idx
  on customer_invites (dealership_id);

create index if not exists customer_invites_token_idx
  on customer_invites (token);

create index if not exists customer_invites_email_idx
  on customer_invites (email);

-- Step 3: Enable RLS
alter table customer_invites enable row level security;

-- Step 4: Create RLS policies
-- Dealership staff can see/manage customer invites for their own dealership
drop policy if exists customer_invites_select_own on customer_invites;
create policy customer_invites_select_own on customer_invites
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists customer_invites_insert_own on customer_invites;
create policy customer_invites_insert_own on customer_invites
  for insert with check (
    dealership_id = public.current_dealership_id()
    and exists (
      select 1 from users
      where id = auth.uid() 
      and dealership_id = public.current_dealership_id()
      and role = 'admin'
    )
  );

drop policy if exists customer_invites_delete_own on customer_invites;
create policy customer_invites_delete_own on customer_invites
  for delete using (dealership_id = public.current_dealership_id());

-- Step 5: Create function to validate customer invitation (for public signup)
create or replace function public.get_customer_invite(p_token text)
returns table(
  customer_name text,
  email text,
  dealership_name text,
  dealership_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select ci.customer_name, ci.email, d.name, d.id
  from customer_invites ci
  join dealerships d on d.id = ci.dealership_id
  where ci.token = p_token
    and ci.used_at is null
    and ci.expires_at > now();
end;
$$;

-- Step 6: Grant execute permission for public signup
grant execute on function public.get_customer_invite(text) to anon, authenticated;

-- Step 7: Update handle_new_user() trigger to support customer invitations
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
  dealership_signup_code text;
  matched_invite dealership_invites%rowtype;
  matched_customer_invite customer_invites%rowtype;
  validated_dealership record;
begin
  dealership_name := new.raw_user_meta_data ->> 'dealership_name';
  full_name := new.raw_user_meta_data ->> 'full_name';
  invite_token := new.raw_user_meta_data ->> 'invite_token';
  dealership_signup_code := new.raw_user_meta_data ->> 'dealership_signup_code';

  -- FLOW 1: Customer invitation (NEW - admin-generated)
  if invite_token is not null and length(trim(invite_token)) > 0 then
    -- First check if it's a customer invite
    select * into matched_customer_invite
    from customer_invites
    where token = trim(invite_token)
      and used_at is null
      and expires_at > now()
    limit 1;

    if matched_customer_invite.id is not null then
      -- Validate email matches
      if lower(trim(coalesce(new.email, ''))) <> lower(trim(matched_customer_invite.email)) then
        raise exception 'Customer invite email does not match the account email.';
      end if;

      -- SECURITY: Role is hardcoded to 'customer' - never from client metadata
      insert into users (id, dealership_id, name, email, role)
      values (
        new.id,
        matched_customer_invite.dealership_id,
        coalesce(full_name, matched_customer_invite.customer_name),
        new.email,
        'customer'  -- Hardcoded customer role
      );

      -- Mark invitation as used
      update customer_invites
      set used_at = now()
      where id = matched_customer_invite.id;

      return new;
    end if;

    -- If not a customer invite, check if it's a team invite (existing flow)
    select * into matched_invite
    from dealership_invites
    where token = trim(invite_token)
      and used_at is null
      and expires_at > now()
    limit 1;

    if matched_invite.id is not null then
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
        matched_invite.role  -- manager or salesperson only
      );

      update dealership_invites
      set used_at = now()
      where id = matched_invite.id;

      return new;
    end if;

    -- Invalid/expired invite token
    raise exception 'Invite is invalid or expired.';
  end if;

  -- FLOW 2: Dealership signup code (DISABLED for customer registration)
  -- This flow is now disabled to prevent public customer self-registration
  if dealership_signup_code is not null and length(trim(dealership_signup_code)) > 0 then
    -- Validate the dealership signup code exists
    select * into validated_dealership
    from public.validate_dealership_signup(trim(dealership_signup_code))
    limit 1;
    
    if validated_dealership.id is not null then
      -- SECURITY: Explicitly block customer self-registration via signup codes
      raise exception 'Public customer registration is no longer supported. Please contact your dealership administrator for an invitation.';
    end if;
    
    -- If validation fails, raise generic error
    raise exception 'Invalid dealership signup code.';
  end if;

  -- FLOW 3: Dealership owner signup (creates new dealership + admin)
  if dealership_name is not null and length(trim(dealership_name)) > 0 then
    -- SECURITY: This is the ONLY way to get admin role
    insert into dealerships (name)
    values (trim(dealership_name))
    returning id into new_dealership_id;

    insert into users (id, dealership_id, name, email, role)
    values (new.id, new_dealership_id, full_name, new.email, 'admin');

    return new;
  end if;

  -- FLOW 4: No valid signup path
  -- SECURITY: Do NOT create a users row for unsupported signup attempts
  raise exception 'Invalid signup. Please use a dealership invite, customer invitation, or contact support.';
end;
$$;
