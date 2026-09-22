-- 0032_customer_crm_access.sql
-- Customer role: view all CRM records, create/edit own customers and leads,
-- reports view/download only, no delete.

-- =========================
-- CUSTOMERS
-- =========================

drop policy if exists customers_select_own_dealership on customers;
create policy customers_select_own_dealership on customers
  for select using (
    dealership_id = public.current_dealership_id()
  );

drop policy if exists customers_insert_own_dealership on customers;
create policy customers_insert_own_dealership on customers
  for insert with check (
    dealership_id = public.current_dealership_id()
    and (
      (select role from users where id = auth.uid())
        in ('admin', 'manager', 'salesperson')
      or (
        (select role from users where id = auth.uid()) = 'customer'
        and created_by = auth.uid()
      )
    )
  );

drop policy if exists customers_update_own_dealership on customers;
create policy customers_update_own_dealership on customers
  for update using (
    dealership_id = public.current_dealership_id()
    and (
      (select role from users where id = auth.uid())
        in ('admin', 'manager', 'salesperson')
      or (
        (select role from users where id = auth.uid()) = 'customer'
        and created_by = auth.uid()
      )
    )
  )
  with check (
    dealership_id = public.current_dealership_id()
    and (
      (select role from users where id = auth.uid())
        in ('admin', 'manager', 'salesperson')
      or (
        (select role from users where id = auth.uid()) = 'customer'
        and created_by = auth.uid()
      )
    )
  );

drop policy if exists customers_delete_own_dealership on customers;
create policy customers_delete_own_dealership on customers
  for delete using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid())
      in ('admin', 'manager', 'salesperson')
  );


-- =========================
-- LEADS
-- =========================

drop policy if exists leads_select_own_dealership on leads;
create policy leads_select_own_dealership on leads
  for select using (
    dealership_id = public.current_dealership_id()
  );

drop policy if exists leads_insert_own_dealership on leads;
create policy leads_insert_own_dealership on leads
  for insert with check (
    dealership_id = public.current_dealership_id()
    and (
      (select role from users where id = auth.uid())
        in ('admin', 'manager', 'salesperson')
      or (
        (select role from users where id = auth.uid()) = 'customer'
        and created_by = auth.uid()
      )
    )
  );

drop policy if exists leads_update_own_dealership on leads;
create policy leads_update_own_dealership on leads
  for update using (
    dealership_id = public.current_dealership_id()
    and (
      (select role from users where id = auth.uid())
        in ('admin', 'manager', 'salesperson')
      or (
        (select role from users where id = auth.uid()) = 'customer'
        and created_by = auth.uid()
      )
    )
  )
  with check (
    dealership_id = public.current_dealership_id()
    and (
      (select role from users where id = auth.uid())
        in ('admin', 'manager', 'salesperson')
      or (
        (select role from users where id = auth.uid()) = 'customer'
        and created_by = auth.uid()
      )
    )
  );

drop policy if exists leads_delete_own_dealership on leads;
create policy leads_delete_own_dealership on leads
  for delete using (
    dealership_id = public.current_dealership_id()
    and (select role from users where id = auth.uid())
      in ('admin', 'manager', 'salesperson')
  );


-- =========================
-- REPORTS: READ ONLY FOR CUSTOMER
-- =========================

drop policy if exists reports_select_own_dealership on reports;
create policy reports_select_own_dealership on reports
  for select using (
    vehicle_id in (
      select id
      from vehicles
      where dealership_id = public.current_dealership_id()
    )
  );

drop policy if exists reports_insert_own_dealership on reports;
create policy reports_insert_own_dealership on reports
  for insert with check (
    vehicle_id in (
      select id
      from vehicles
      where dealership_id = public.current_dealership_id()
    )
    and (select role from users where id = auth.uid())
      in ('admin', 'manager', 'salesperson')
  );

drop policy if exists reports_update_own_dealership on reports;
create policy reports_update_own_dealership on reports
  for update using (
    vehicle_id in (
      select id
      from vehicles
      where dealership_id = public.current_dealership_id()
    )
    and (select role from users where id = auth.uid())
      in ('admin', 'manager', 'salesperson')
  )
  with check (
    vehicle_id in (
      select id
      from vehicles
      where dealership_id = public.current_dealership_id()
    )
    and (select role from users where id = auth.uid())
      in ('admin', 'manager', 'salesperson')
  );

-- =========================
-- PUBLIC SHARED REPORTS
-- =========================
-- Keep shared report links publicly accessible without granting
-- authenticated users access to reports outside their dealership.

drop policy if exists reports_select_by_share_token on reports;
create policy reports_select_by_share_token on reports
  for select
  to anon
  using (share_token is not null);