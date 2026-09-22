-- 0028_customer_signup.sql
-- Add customer self-signup support with dealership-specific signup codes
-- Run this in Supabase SQL Editor

-- Step 1: Add signup_code column to dealerships table
alter table dealerships 
add column if not exists signup_code text unique;

-- Step 2: Generate unique signup codes for existing dealerships
update dealerships 
set signup_code = encode(gen_random_bytes(16), 'hex')
where signup_code is null;

-- Step 3: Create function to validate dealership signup code
create or replace function public.validate_dealership_signup(p_code text)
returns table(id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select dealerships.id, dealerships.name
  from dealerships
  where dealerships.signup_code = p_code;
end;
$$;

-- Step 4: Grant execute to anon and authenticated for signup validation
grant execute on function public.validate_dealership_signup(text) to anon, authenticated;

-- Step 5: Add function to regenerate dealership signup code (admin only)
create or replace function public.regenerate_dealership_signup()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealership_id uuid;
  v_new_code text;
begin
  -- Get current user's dealership
  select dealership_id into v_dealership_id
  from users
  where id = auth.uid();
  
  if v_dealership_id is null then
    raise exception 'User not associated with a dealership';
  end if;
  
  -- Verify user is admin
  if not exists (
    select 1 from users
    where id = auth.uid() 
    and dealership_id = v_dealership_id
    and role = 'admin'
  ) then
    raise exception 'Only dealership admins can regenerate signup codes';
  end if;
  
  -- Generate new unique code
  v_new_code := encode(gen_random_bytes(16), 'hex');
  
  -- Update dealership
  update dealerships
  set signup_code = v_new_code
  where id = v_dealership_id;
  
  return v_new_code;
end;
$$;

-- Step 6: Grant execute to authenticated for code regeneration
grant execute on function public.regenerate_dealership_signup() to authenticated;
