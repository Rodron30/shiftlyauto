-- 0032_vehicle_appearance_title.sql
-- Add vehicle appearance and title status fields for Facebook Marketplace integration

-- Add exterior color column
alter table vehicles add column if not exists exterior_color text;

-- Add interior color column  
alter table vehicles add column if not exists interior_color text;

-- Add clean title status column
alter table vehicles add column if not exists has_clean_title boolean;

-- Add comments for documentation
comment on column vehicles.exterior_color is 'Vehicle exterior color (e.g., Black, White, Red)';
comment on column vehicles.interior_color is 'Vehicle interior color (e.g., Black, Gray, Beige)';
comment on column vehicles.has_clean_title is 'Whether the vehicle has a clean title status';
