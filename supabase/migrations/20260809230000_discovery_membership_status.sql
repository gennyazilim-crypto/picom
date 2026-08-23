-- The discovery card must derive its action from authoritative membership state,
-- not only from the communities already hydrated in the renderer.
-- PostgreSQL treats the additional OUT column as a return-type change. The
-- dependency check before applying this migration must remain empty; do not use
-- CASCADE here.
drop function if exists public.list_public_discovery_communities(text, text, integer);

create or replace function public.list_public_discovery_communities(
  search_text text default null,
  category_filter text default null,
  result_limit integer default 60
)
returns table(
  id uuid,
  name text,
  description text,
  icon_url text,
  accent_color text,
  category text,
  member_count bigint,
  join_policy text,
  is_member boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    community.id,
    community.name,
    community.description,
    community.icon_url,
    community.accent_color,
    community.category,
    count(membership.id) as member_count,
    community.discovery_join_policy as join_policy,
    coalesce(bool_or(membership.user_id = auth.uid()), false) as is_member
  from public.communities community
  join public.community_discovery_reviews review
    on review.community_id = community.id and review.status = 'approved'
  left join public.community_members membership on membership.community_id = community.id
  where community.visibility = 'public'
    and community.public_read_enabled = true
    and community.discovery_listed = true
    and (category_filter is null or community.category = category_filter)
    and (
      search_text is null
      or btrim(search_text) = ''
      or community.name ilike '%' || left(btrim(search_text), 80) || '%'
      or coalesce(community.description, '') ilike '%' || left(btrim(search_text), 80) || '%'
    )
  group by community.id
  order by count(membership.id) desc, community.created_at desc
  limit least(greatest(result_limit, 1), 60);
$$;

revoke all on function public.list_public_discovery_communities(text, text, integer) from public;
grant execute on function public.list_public_discovery_communities(text, text, integer) to anon, authenticated;
