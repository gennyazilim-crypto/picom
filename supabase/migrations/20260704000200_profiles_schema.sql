-- Profiles table schema hardening
-- Adds user-facing validation constraints for the MVP profile surface.

alter table public.profiles
  add constraint profiles_username_length check (char_length(username) between 3 and 32),
  add constraint profiles_username_format check (username ~ '^[a-z0-9._-]+$'),
  add constraint profiles_display_name_length check (char_length(display_name) between 1 and 80),
  add constraint profiles_status_text_length check (char_length(status_text) <= 120),
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 500),
  add constraint profiles_accent_color_format check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');

create unique index if not exists profiles_username_lower_unique on public.profiles (lower(username));
create index if not exists idx_profiles_status on public.profiles(status);
