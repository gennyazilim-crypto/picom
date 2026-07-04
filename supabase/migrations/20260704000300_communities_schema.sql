-- Communities table schema hardening
-- Keeps the baseline table intact and adds MVP-safe validation/query helpers.

alter table public.communities
  add constraint communities_name_length check (char_length(name) between 1 and 80),
  add constraint communities_description_length check (description is null or char_length(description) <= 500),
  add constraint communities_icon_url_length check (icon_url is null or char_length(icon_url) <= 2048),
  add constraint communities_accent_color_format check (accent_color ~ '^#[0-9A-Fa-f]{6}$');

create index if not exists idx_communities_owner_id on public.communities(owner_id);
create index if not exists idx_communities_created_at on public.communities(created_at desc);