-- 0018_history_accident_claim.sql
-- Adds ACCIDENT and CLAIM as first-class history event types
-- This enables proper CARFAX integration for accident and claims history

-- Drop the existing check constraint
alter table history_events drop constraint if exists history_events_event_type_check;

-- Add the updated check constraint with ACCIDENT and CLAIM
alter table history_events 
  add constraint history_events_event_type_check 
  check (event_type in ('THEFT', 'ODOMETER', 'ACCIDENT', 'CLAIM', 'OTHER'));

-- Add comment to document the change
comment on column history_events.event_type is 
  'Event type: THEFT, ODOMETER, ACCIDENT, CLAIM, or OTHER. ACCIDENT and CLAIM added for CARFAX integration.';
