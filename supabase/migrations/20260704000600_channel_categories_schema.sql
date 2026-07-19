-- Channel categories table schema hardening
-- Keeps community sidebar grouping predictable for the desktop MVP.

alter table public.channel_categories
  add constraint channel_categories_name_length check (char_length(name) between 1 and 80),
  add constraint channel_categories_position_range check (position between 0 and 10000);
create unique index if not exists channel_categories_community_lower_name_unique
  on public.channel_categories (community_id, lower(name));
