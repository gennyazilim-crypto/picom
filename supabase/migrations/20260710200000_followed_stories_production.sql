-- Followed-user story projection for Picom desktop. Stories are derived from
-- existing RLS-protected resources; voice rows are backend-produced facts.

create table if not exists public.voice_story_events (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= created_at)
);
create index if not exists idx_voice_story_events_author_created
  on public.voice_story_events(author_id, created_at desc, id);
create index if not exists idx_voice_story_events_channel_active
  on public.voice_story_events(channel_id, created_at desc)
  where ended_at is null;
alter table public.voice_story_events enable row level security;
revoke all on public.voice_story_events from public, anon, authenticated;
grant select on public.voice_story_events to authenticated;
drop policy if exists "voice_story_events_select_followed_visible" on public.voice_story_events;
create policy "voice_story_events_select_followed_visible"
on public.voice_story_events for select to authenticated
using (
  exists (
    select 1 from public.user_follows follow
    where follow.follower_id = auth.uid() and follow.followed_id = author_id
  )
  and exists (
    select 1 from public.channels channel
    where channel.id = channel_id
      and channel.community_id = community_id
      and public.can_view_channel(channel.id)
  )
  and not public.users_are_blocked(auth.uid(), author_id)
);
drop view if exists public.followed_user_stories_view;
create view public.followed_user_stories_view
with (security_invoker = true)
as
select * from (
  select
    ('status:' || profile.id::text || ':' || extract(epoch from profile.updated_at)::bigint::text) as story_id,
    profile.id as author_id,
    null::uuid as community_id,
    null::uuid as channel_id,
    null::uuid as message_id,
    'status'::text as story_type,
    left(coalesce(nullif(profile.status_text, ''), profile.display_name || ' shared an update'), 120) as title,
    'Status update'::text as subtitle,
    left(nullif(profile.status_text, ''), 360) as body,
    null::text as image_url,
    'story-bg-ocean'::text as gradient_variant,
    profile.updated_at as created_at,
    8 as duration_seconds,
    array[]::uuid[] as mentioned_user_ids
  from public.user_follows follow
  join public.profiles profile on profile.id = follow.followed_id
  where follow.follower_id = auth.uid()
    and public.can_view_profile(profile.id)

  union all

  select
    'media:' || message.id::text,
    message.author_id,
    message.community_id,
    message.channel_id,
    message.id,
    'media',
    left(coalesce(nullif(message.body, ''), 'Shared new media'), 120),
    'Shared media',
    left(nullif(message.body, ''), 360),
    media.public_url,
    'story-bg-mountain',
    message.created_at,
    8,
    array[]::uuid[]
  from public.messages message
  join public.user_follows follow
    on follow.follower_id = auth.uid() and follow.followed_id = message.author_id
  join lateral (
    select attachment.public_url
    from public.attachments attachment
    where attachment.message_id = message.id
      and attachment.status = 'attached'
      and attachment.scan_status in ('clean', 'skipped_development')
      and attachment.public_url is not null
    order by attachment.created_at, attachment.id
    limit 1
  ) media on true
  where message.deleted_at is null and public.can_view_message(message.id)

  union all

  select
    'mention:' || message.id::text,
    message.author_id,
    message.community_id,
    message.channel_id,
    message.id,
    'mention_highlight',
    left(coalesce(nullif(message.body, ''), 'Mention highlight'), 120),
    'Mention highlight',
    left(nullif(message.body, ''), 360),
    null::text,
    'story-bg-warm',
    message.created_at,
    9,
    mention_data.mentioned_user_ids
  from public.messages message
  join public.user_follows follow
    on follow.follower_id = auth.uid() and follow.followed_id = message.author_id
  join lateral (
    select array_agg(mention.mentioned_user_id order by mention.mentioned_user_id) as mentioned_user_ids
    from public.message_mentions mention where mention.message_id = message.id
  ) mention_data on cardinality(mention_data.mentioned_user_ids) > 0
  where message.deleted_at is null and public.can_view_message(message.id)

  union all

  select
    'announcement:' || message.id::text,
    message.author_id,
    message.community_id,
    message.channel_id,
    message.id,
    'community_update',
    left(coalesce(nullif(message.body, ''), 'Community update'), 120),
    'Community update',
    left(nullif(message.body, ''), 360),
    null::text,
    'story-bg-teal',
    message.created_at,
    9,
    array[]::uuid[]
  from public.messages message
  join public.channels channel on channel.id = message.channel_id and channel.type = 'announcement'
  join public.user_follows follow
    on follow.follower_id = auth.uid() and follow.followed_id = message.author_id
  where message.deleted_at is null and public.can_view_message(message.id)

  union all

  select
    'event:' || event.id::text,
    event.created_by,
    event.community_id,
    event.channel_id,
    null::uuid,
    'event',
    left(event.title, 120),
    'Upcoming event',
    left(nullif(event.description, ''), 360),
    null::text,
    'story-bg-event',
    event.created_at,
    9,
    array[]::uuid[]
  from public.community_events event
  join public.user_follows follow
    on follow.follower_id = auth.uid() and follow.followed_id = event.created_by
  where event.cancelled_at is null
    and (event.channel_id is null or public.can_view_channel(event.channel_id))

  union all

  select
    'voice:' || voice.id::text,
    voice.author_id,
    voice.community_id,
    voice.channel_id,
    null::uuid,
    'voice',
    left(voice.title, 120),
    case when voice.ended_at is null then 'Voice room live' else 'Voice update' end,
    null::text,
    null::text,
    'story-bg-voice',
    voice.created_at,
    10,
    array[]::uuid[]
  from public.voice_story_events voice
) story
where not public.users_are_blocked(auth.uid(), story.author_id);
revoke all on public.followed_user_stories_view from public, anon;
grant select on public.followed_user_stories_view to authenticated;
create or replace function public.list_followed_user_stories(
  cursor_created_at timestamptz default null,
  cursor_story_id text default null,
  result_limit integer default 30
)
returns table (
  story_id text,
  author_id uuid,
  community_id uuid,
  channel_id uuid,
  message_id uuid,
  story_type text,
  title text,
  subtitle text,
  body text,
  image_url text,
  gradient_variant text,
  created_at timestamptz,
  duration_seconds integer,
  mentioned_user_ids uuid[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    story.story_id, story.author_id, story.community_id, story.channel_id, story.message_id,
    story.story_type, story.title, story.subtitle, story.body, story.image_url,
    story.gradient_variant, story.created_at, story.duration_seconds, story.mentioned_user_ids
  from public.followed_user_stories_view story
  where auth.uid() is not null
    and story.created_at >= now() - interval '7 days'
    and (
      cursor_created_at is null
      or story.created_at < cursor_created_at
      or (story.created_at = cursor_created_at and cursor_story_id is not null and story.story_id < cursor_story_id)
    )
  order by story.created_at desc, story.story_id desc
  limit least(greatest(result_limit, 1), 60);
$$;
revoke all on function public.list_followed_user_stories(timestamptz, text, integer) from public, anon;
grant execute on function public.list_followed_user_stories(timestamptz, text, integer) to authenticated;
comment on table public.voice_story_events is
  'Backend-produced, content-free voice story facts. Normal authenticated clients cannot insert or mutate rows.';
comment on view public.followed_user_stories_view is
  'RLS-invoker union of followed profiles, visible media/mentions/announcements/events and authorized voice facts.';
