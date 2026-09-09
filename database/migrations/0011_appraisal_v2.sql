-- 0011_appraisal_v2.sql
-- V2 - Appraisal valuation outputs

alter table trade_appraisals
  add column if not exists history_score integer;

alter table trade_appraisals
  add column if not exists wholesale_estimate numeric(12, 2);

alter table trade_appraisals
  add column if not exists retail_estimate numeric(12, 2);

alter table trade_appraisals
  add constraint trade_appraisals_history_score_check
  check (
    history_score is null
    or (history_score >= 0 and history_score <= 100)
  );
