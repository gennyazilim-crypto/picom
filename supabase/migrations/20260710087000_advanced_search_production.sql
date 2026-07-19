create extension if not exists pg_trgm with schema extensions;
alter table public.messages
  add column if not exists search_vector tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(body, ''))) stored;
create index if not exists idx_messages_search_vector_visible
  on public.messages using gin(search_vector)
  where deleted_at is null;
create index if not exists idx_messages_body_trgm_visible
  on public.messages using gin(lower(body) extensions.gin_trgm_ops)
  where deleted_at is null;
create index if not exists idx_channels_name_trgm
  on public.channels using gin(lower(name) extensions.gin_trgm_ops);
create index if not exists idx_communities_name_trgm
  on public.communities using gin(lower(name) extensions.gin_trgm_ops);
create index if not exists idx_profiles_display_name_trgm
  on public.profiles using gin(lower(display_name) extensions.gin_trgm_ops);
create index if not exists idx_profiles_username_trgm
  on public.profiles using gin(lower(username) extensions.gin_trgm_ops);
create or replace function public.search_accessible_entities(
  query_text text,
  category_filter text default null,
  result_limit integer default 40
)
returns table(
  result_type text,
  entity_id uuid,
  label text,
  detail text,
  community_id uuid,
  channel_id uuid,
  message_id uuid,
  user_id uuid,
  created_at timestamptz,
  rank real
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  normalized_query text;
  full_text_query tsquery;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  normalized_query := left(regexp_replace(btrim(coalesce(query_text, '')), '[%_]', '', 'g'), 80);
  if char_length(normalized_query) < 2 then raise exception 'SEARCH_QUERY_TOO_SHORT'; end if;
  if category_filter is not null and category_filter not in ('community','channel','member','message','mention','saved_message') then
    raise exception 'SEARCH_CATEGORY_INVALID';
  end if;
  full_text_query := websearch_to_tsquery('simple'::regconfig, normalized_query);

  return query
  with current_profile as (
    select profile.username from public.profiles profile where profile.id = auth.uid()
  ), combined as (
    select
      'community'::text as result_type,
      community.id as entity_id,
      community.name as label,
      left(coalesce(community.description, 'Accessible community'), 180) as detail,
      community.id as community_id,
      null::uuid as channel_id,
      null::uuid as message_id,
      null::uuid as user_id,
      community.created_at,
      greatest(extensions.similarity(lower(community.name), lower(normalized_query)), 0.05)::real as rank
    from public.communities community
    where (
      exists (select 1 from public.community_members membership where membership.community_id = community.id and membership.user_id = auth.uid())
      or (community.visibility = 'public' and community.public_read_enabled = true)
    )
      and (community.name ilike '%' || normalized_query || '%' or coalesce(community.description, '') ilike '%' || normalized_query || '%')

    union all

    select
      'channel', channel.id, '#' || channel.name, 'Accessible channel', channel.community_id,
      channel.id, null::uuid, null::uuid, channel.created_at,
      greatest(extensions.similarity(lower(channel.name), lower(normalized_query)), 0.05)::real
    from public.channels channel
    where public.can_view_channel(channel.id)
      and (channel.name ilike '%' || normalized_query || '%' or coalesce(channel.topic, '') ilike '%' || normalized_query || '%')

    union all

    select
      'member', profile.id, profile.display_name, '@' || profile.username, membership.community_id,
      null::uuid, null::uuid, profile.id, profile.created_at,
      greatest(extensions.similarity(lower(profile.display_name), lower(normalized_query)), extensions.similarity(lower(profile.username), lower(normalized_query)), 0.05)::real
    from public.community_members membership
    join public.profiles profile on profile.id = membership.user_id
    where exists (
      select 1 from public.community_members requester
      where requester.community_id = membership.community_id and requester.user_id = auth.uid()
    )
      and (profile.display_name ilike '%' || normalized_query || '%' or profile.username ilike '%' || normalized_query || '%')

    union all

    select
      'message', message.id, left(message.body, 160), 'Accessible message', message.community_id,
      message.channel_id, message.id, message.author_id, message.created_at,
      greatest(ts_rank(message.search_vector, full_text_query), extensions.similarity(lower(message.body), lower(normalized_query)), 0.01)::real
    from public.messages message
    where message.deleted_at is null
      and public.can_view_channel(message.channel_id)
      and (message.search_vector @@ full_text_query or message.body ilike '%' || normalized_query || '%')

    union all

    select
      'mention', message.id, left(message.body, 160), 'Mention in an accessible message', message.community_id,
      message.channel_id, message.id, message.author_id, message.created_at,
      greatest(ts_rank(message.search_vector, full_text_query), 0.05)::real
    from public.messages message
    cross join current_profile profile
    where message.deleted_at is null
      and public.can_view_channel(message.channel_id)
      and message.body ilike '%@' || profile.username || '%'
      and (message.search_vector @@ full_text_query or message.body ilike '%' || normalized_query || '%')

    union all

    select
      'saved_message', saved.id, left(message.body, 160), 'Your saved accessible message', message.community_id,
      message.channel_id, message.id, message.author_id, saved.created_at,
      greatest(ts_rank(message.search_vector, full_text_query), extensions.similarity(lower(message.body), lower(normalized_query)), 0.01)::real
    from public.saved_messages saved
    join public.messages message on message.id = saved.message_id
    where saved.user_id = auth.uid()
      and message.deleted_at is null
      and public.can_view_channel(message.channel_id)
      and (message.search_vector @@ full_text_query or message.body ilike '%' || normalized_query || '%')
  )
  select
    combined.result_type, combined.entity_id, combined.label, combined.detail,
    combined.community_id, combined.channel_id, combined.message_id, combined.user_id,
    combined.created_at, combined.rank
  from combined
  where category_filter is null or combined.result_type = category_filter
  order by combined.rank desc, combined.created_at desc
  limit least(greatest(result_limit, 1), 80);
end;
$$;
revoke all on function public.search_accessible_entities(text,text,integer) from public, anon;
grant execute on function public.search_accessible_entities(text,text,integer) to authenticated;
comment on function public.search_accessible_entities(text,text,integer) is
  'Authenticated unified search with explicit community/channel/message visibility, member-list membership, mention, and user-owned saved-message checks.';
