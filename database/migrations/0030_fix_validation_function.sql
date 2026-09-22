-- 0030_fix_validation_function.sql
-- Fix ambiguous column reference in validate_dealership_signup function
-- Run this in Supabase SQL Editor

-- Drop and recreate the function with table-qualified column names
drop function if exists public.validate_dealership_signup(text);

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

-- Re-grant execute permissions
grant execute on function public.validate_dealership_signup(text) to anon, authenticated;
