-- 0034_trade_appraisals_delete_policy.sql
-- Security: trade appraisals must not be directly deletable by dealership users.
-- There is no DELETE API workflow for this resource.

drop policy if exists trade_appraisals_delete_own_dealership
on trade_appraisals;
