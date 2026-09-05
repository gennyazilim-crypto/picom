alter table public.user_settings
  add column if not exists preferred_locale text not null default 'en';

alter table public.user_settings
  drop constraint if exists user_settings_preferred_locale_check;

alter table public.user_settings
  add constraint user_settings_preferred_locale_check
  check (preferred_locale in ('en', 'tr', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru'));

alter table public.user_settings
  add column if not exists preferred_locale_mode text not null default 'system';

alter table public.user_settings
  drop constraint if exists user_settings_preferred_locale_mode_check;

alter table public.user_settings
  add constraint user_settings_preferred_locale_mode_check
  check (preferred_locale_mode in ('system', 'manual'));

comment on column public.user_settings.preferred_locale is 'User-selected Picom UI language (UiLanguage code); local preference remains authoritative if sync fails.';
comment on column public.user_settings.preferred_locale_mode is '"system": language is re-resolved from the OS/browser locale on every read. "manual": preferred_locale is pinned and never overridden by OS locale changes.';
