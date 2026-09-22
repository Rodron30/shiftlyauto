-- 0029_customer_signup_trigger.sql
-- Update signup trigger to handle customer self-signup via dealership code
-- Run this in Supabase SQL Editor after 0028_customer_signup.sql

-- Update handle_new_user() trigger to support customer self-signup
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
  validated_dealership record;
begin
  dealership_name := new.raw_user_meta_data ->> 'dealership_name';
  full_name := new.raw_user_meta_data ->> 'full_name';
  invite_token := new.raw_user_meta_data ->> 'invite_token';
  dealership_signup_code := new.raw_user_meta_data ->> 'dealership_signup_code';

  -- FLOW 1: Customer self-signup via dealership code
  if dealership_signup_code is not null and length(trim(dealership_signup_code)) > 0 then
    -- Validate the dealership signup code
    select * into validated_dealership
    from public.validate_dealership_signup(trim(dealership_signup_code))
    limit 1;
    
    if validated_dealership.id is null then
      raise exception 'Invalid dealership signup code.';
    end if;
    
    -- SECURITY: Role is hardcoded to 'customer' - not from client metadata
    insert into users (id, dealership_id, name, email, role)
    values (
      new.id,
      validated_dealership.id,
      full_name,
      new.email,
      'customer'  -- Hardcoded customer role
    );
    
    return new;
  end if;

  -- FLOW 2: Invite-based signup (validated dealership staff)
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
      matched_invite.role  -- manager or salesperson only
    );

    update dealership_invites
    set used_at = now()
    where id = matched_invite.id;

    return new;
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
  raise exception 'Invalid signup. Please use a dealership invite, customer signup link, or contact support.';
end;
$$;
