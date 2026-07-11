-- Task 435: canonical Full MVP community kinds.
-- Existing communities remain intact and are classified as text communities.

do $$
begin
  create type public.community_kind as enum ('text', 'radio', 'podcast');
exception
  when duplicate_object then null;
end
$$;

do $$
declare
  existing_udt_name text;
begin
  select columns.udt_name
    into existing_udt_name
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'communities'
    and columns.column_name = 'kind';

  if existing_udt_name is null then
    alter table public.communities add column kind public.community_kind;
  elsif existing_udt_name <> 'community_kind' then
    if exists (
      select 1
      from public.communities
      where kind is not null
        and kind::text not in ('text', 'radio', 'podcast')
    ) then
      raise exception 'COMMUNITY_KIND_MIGRATION_INVALID_EXISTING_VALUE' using errcode = '23514';
    end if;

    alter table public.communities
      alter column kind type public.community_kind
      using kind::text::public.community_kind;
  end if;
end
$$;

update public.communities
set kind = 'text'::public.community_kind
where kind is null;

alter table public.communities
  alter column kind set default 'text'::public.community_kind,
  alter column kind set not null;

create index if not exists idx_communities_kind_created_at
  on public.communities(kind, created_at desc);

grant usage on type public.community_kind to anon, authenticated, service_role;

comment on type public.community_kind is
  'Canonical Picom Full MVP product spaces. Hybrid communities are intentionally excluded.';

comment on column public.communities.kind is
  'Immutable-at-creation community product kind: text, radio, or podcast.';
