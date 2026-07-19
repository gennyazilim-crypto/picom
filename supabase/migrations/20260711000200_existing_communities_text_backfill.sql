-- Task 436: idempotent forward-only legacy community backfill.
-- Task 435 creates the enum/column. This migration is safe to rerun and never
-- overwrites an explicit radio or podcast classification.

do $$
begin
  if to_regtype('public.community_kind') is null then
    raise exception 'COMMUNITY_KIND_TYPE_REQUIRED' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'communities'
      and column_name = 'kind'
  ) then
    raise exception 'COMMUNITY_KIND_COLUMN_REQUIRED' using errcode = '55000';
  end if;
end
$$;

update public.communities
set kind = 'text'::public.community_kind
where kind is null;

alter table public.communities
  alter column kind set default 'text'::public.community_kind,
  alter column kind set not null;

do $$
begin
  if exists (select 1 from public.communities where kind is null) then
    raise exception 'COMMUNITY_KIND_BACKFILL_INCOMPLETE' using errcode = '23502';
  end if;
end
$$;

comment on column public.communities.kind is
  'Canonical community product kind. Legacy rows were backfilled to text; explicit radio/podcast values are preserved.';;
