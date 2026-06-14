alter table public.profiles
  add column if not exists genres text[] default '{}',
  add column if not exists onboarded_at timestamptz;
