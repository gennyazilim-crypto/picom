-- Roles table schema hardening
-- Keeps role records portable and permission metadata predictable.

alter table public.roles
  alter column color set default '#007571';
alter table public.roles
  add constraint roles_name_length check (char_length(name) between 1 and 40),
  add constraint roles_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint roles_level_range check (level between 0 and 100),
  add constraint roles_permissions_is_object check (jsonb_typeof(permissions) = 'object');
create unique index if not exists roles_community_lower_name_unique
  on public.roles (community_id, lower(name));
create index if not exists idx_roles_community_level
  on public.roles(community_id, level desc);
