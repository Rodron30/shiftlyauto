-- 0024_vehicle_currency.sql
-- Add currency column to vehicles table to support multiple currencies
-- Default existing vehicles to USD to preserve current behavior

alter table public.vehicles
  add column if not exists currency text default 'USD';

-- Add check constraint for valid currency codes
alter table public.vehicles
  add constraint vehicles_currency_check 
  check (currency in ('USD', 'PHP', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'HKD', 'MYR', 'THB', 'IDR', 'VND'));

-- Create index for currency queries
create index if not exists vehicles_currency_idx 
  on public.vehicles(currency);
