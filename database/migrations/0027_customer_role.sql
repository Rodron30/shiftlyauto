-- 0027_customer_role.sql
-- Add customer role for external customer access to CRM/Leads and Reports

-- Update role constraint to include customer
alter table users
  drop constraint if exists users_role_check;

alter table users
  add constraint users_role_check
  check (role in ('admin', 'manager', 'salesperson', 'customer'));

-- Role-based RLS policies for vehicles (customer = read-only)
drop policy if exists vehicles_select_own_dealership on vehicles;
create policy vehicles_select_own_dealership on vehicles
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists vehicles_insert_own_dealership on vehicles;
create policy vehicles_insert_own_dealership on vehicles
  for insert with check (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists vehicles_update_own_dealership on vehicles;
create policy vehicles_update_own_dealership on vehicles
  for update using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  )
  with check (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists vehicles_delete_own_dealership on vehicles;
create policy vehicles_delete_own_dealership on vehicles
  for delete using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

-- Role-based RLS policies for leads (customer = read-only)
drop policy if exists leads_select_own_dealership on leads;
create policy leads_select_own_dealership on leads
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists leads_insert_own_dealership on leads;
create policy leads_insert_own_dealership on leads
  for insert with check (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists leads_update_own_dealership on leads;
create policy leads_update_own_dealership on leads
  for update using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  )
  with check (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists leads_delete_own_dealership on leads;
create policy leads_delete_own_dealership on leads
  for delete using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

-- Role-based RLS policies for customers (customer = read-only)
drop policy if exists customers_select_own_dealership on customers;
create policy customers_select_own_dealership on customers
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists customers_insert_own_dealership on customers;
create policy customers_insert_own_dealership on customers
  for insert with check (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists customers_update_own_dealership on customers;
create policy customers_update_own_dealership on customers
  for update using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  )
  with check (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists customers_delete_own_dealership on customers;
create policy customers_delete_own_dealership on customers
  for delete using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

-- Role-based RLS policies for salesperson_activities (customer = no access)
drop policy if exists salesperson_activities_select_own_dealership on salesperson_activities;
create policy salesperson_activities_select_own_dealership on salesperson_activities
  for select using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists salesperson_activities_insert_own_dealership on salesperson_activities;
create policy salesperson_activities_insert_own_dealership on salesperson_activities
  for insert with check (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists salesperson_activities_update_own_dealership on salesperson_activities;
create policy salesperson_activities_update_own_dealership on salesperson_activities
  for update using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  )
  with check (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists salesperson_activities_delete_own_dealership on salesperson_activities;
create policy salesperson_activities_delete_own_dealership on salesperson_activities
  for delete using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

-- Role-based RLS policies for reports (customer = read-only)
drop policy if exists reports_select_own_dealership on reports;
create policy reports_select_own_dealership on reports
  for select using (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
  );

drop policy if exists reports_insert_own_dealership on reports;
create policy reports_insert_own_dealership on reports
  for insert with check (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );

drop policy if exists reports_update_own_dealership on reports;
create policy reports_update_own_dealership on reports
  for update using (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  )
  with check (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
    and (select role from users where id = auth.uid()) in ('admin', 'manager', 'salesperson')
  );
