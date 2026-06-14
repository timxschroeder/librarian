alter table public.profiles
  add column if not exists genres text[] default '{}',
  add column if not exists onboarded_at timestamptz;

-- Existing users are already set up — skip onboarding for them
update public.profiles
  set onboarded_at = now()
  where onboarded_at is null;
