-- 0037_restrict_current_dealership_id_execute.sql
-- Security hardening: current_dealership_id() is an internal authenticated RLS helper.

revoke execute
on function public.current_dealership_id()
from public;

grant execute
on function public.current_dealership_id()
to authenticated, service_role;
