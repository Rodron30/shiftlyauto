-- 0038_revoke_anon_current_dealership_id.sql
-- Security hardening: anonymous users must not execute this internal RLS helper.

revoke execute
on function public.current_dealership_id()
from anon;
