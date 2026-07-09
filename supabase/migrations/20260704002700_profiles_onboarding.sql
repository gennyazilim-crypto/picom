-- First-run onboarding state for Picom desktop profiles.
-- Existing profiles are complete; new profiles use the false default.

alter table public.profiles
  add column if not exists onboarding_completed boolean,
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed = true,
    onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, now())
where onboarding_completed is null;

alter table public.profiles
  alter column onboarding_completed set default false,
  alter column onboarding_completed set not null;

comment on column public.profiles.onboarding_completed is 'True after the user completes the Picom desktop first-run flow.';
comment on column public.profiles.onboarding_completed_at is 'Timestamp of the latest completed first-run flow.';

-- profiles_update_own already limits updates to auth.uid() = id.
