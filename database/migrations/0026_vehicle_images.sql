alter table public.vehicles
  add column if not exists images jsonb not null default '[]'::jsonb;

comment on column public.vehicles.images is
  'All source vehicle image URLs. primary_image remains the featured/first image.';
