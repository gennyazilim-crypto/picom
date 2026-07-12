-- Feed Algorithm V1 derived storage. No source body or private payload is copied here.

create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('text_message','radio_session','radio_comment','podcast_episode','podcast_comment')),
  source_id uuid not null,
  parent_source_id uuid,
  community_id uuid references public.communities(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content_kind text check (content_kind in ('text_only','image_only','text_image','video_only','text_video','image_video','text_image_video')),
  base_score numeric(8,2) not null check (base_score >= 0),
  moderation_state text not null default 'visible' check (moderation_state in ('visible','hidden','removed')),
  deleted_at timestamptz,
  source_created_at timestamptz not null,
  source_updated_at timestamptz not null,
  last_engagement_at timestamptz,
  score_version smallint not null default 1 check (score_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feed_items_source_unique unique (source_type, source_id),
  constraint feed_items_content_kind_scope check (
    (source_type = 'text_message' and content_kind is not null)
    or (source_type <> 'text_message' and content_kind is null)
  ),
  constraint feed_items_source_time_order check (source_updated_at >= source_created_at),
  constraint feed_items_deletion_state check (deleted_at is null or moderation_state <> 'visible')
);

create table if not exists public.feed_engagement_rollups (
  feed_item_id uuid primary key references public.feed_items(id) on delete cascade,
  unique_external_reactors integer not null default 0 check (unique_external_reactors >= 0),
  unique_external_commenters integer not null default 0 check (unique_external_commenters >= 0),
  additional_reply_count integer not null default 0 check (additional_reply_count >= 0),
  unique_external_savers integer not null default 0 check (unique_external_savers >= 0),
  unique_external_viewers integer not null default 0 check (unique_external_viewers >= 0),
  external_supporter_count integer not null default 0 check (external_supporter_count >= 0),
  reaction_score numeric(8,2) not null default 0 check (reaction_score between 0 and 10),
  comment_score numeric(8,2) not null default 0 check (comment_score >= 0),
  save_score numeric(8,2) not null default 0 check (save_score between 0 and 10),
  view_score numeric(8,2) not null default 0 check (view_score between 0 and 3),
  raw_score numeric(10,2) not null default 0 check (raw_score >= 0),
  score_version smallint not null default 1 check (score_version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_user_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  read_at timestamptz,
  saved_at timestamptz,
  hidden_at timestamptz,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feed_user_states_user_item_unique unique (user_id, feed_item_id),
  constraint feed_user_states_seen_order check (last_seen_at is null or first_seen_at is null or last_seen_at >= first_seen_at)
);

create table if not exists public.feed_impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  session_id uuid not null,
  position integer not null check (position >= 0),
  surface text not null default 'mention_feed' check (surface in ('mention_feed')),
  feed_mode text not null check (feed_mode in ('feed','friends')),
  score_version smallint not null default 1 check (score_version > 0),
  as_of timestamptz not null,
  shown_at timestamptz not null default now(),
  opened_at timestamptz,
  constraint feed_impressions_session_item_unique unique (user_id, session_id, feed_item_id),
  constraint feed_impressions_open_order check (opened_at is null or opened_at >= shown_at)
);

create index if not exists idx_feed_items_source on public.feed_items(source_type, source_id);
create index if not exists idx_feed_items_community_created on public.feed_items(community_id, source_created_at desc) where deleted_at is null and moderation_state = 'visible';
create index if not exists idx_feed_items_channel_created on public.feed_items(channel_id, source_created_at desc) where channel_id is not null and deleted_at is null and moderation_state = 'visible';
create index if not exists idx_feed_items_author_created on public.feed_items(author_id, source_created_at desc) where deleted_at is null and moderation_state = 'visible';
create index if not exists idx_feed_items_engaged on public.feed_items(last_engagement_at desc nulls last, source_created_at desc);
create index if not exists idx_feed_items_score_state on public.feed_items(score_version, moderation_state, source_created_at desc);
create index if not exists idx_feed_rollups_raw_score on public.feed_engagement_rollups(score_version, raw_score desc, updated_at desc);
create index if not exists idx_feed_user_states_user_seen on public.feed_user_states(user_id, last_seen_at desc nulls last);
create index if not exists idx_feed_user_states_user_saved on public.feed_user_states(user_id, saved_at desc) where saved_at is not null;
create index if not exists idx_feed_user_states_user_unread on public.feed_user_states(user_id, feed_item_id) where read_at is null;
create index if not exists idx_feed_impressions_user_session on public.feed_impressions(user_id, session_id, position);
create index if not exists idx_feed_impressions_item_opened on public.feed_impressions(feed_item_id, opened_at) where opened_at is not null;

create or replace function public.set_feed_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists feed_items_set_updated_at on public.feed_items;
create trigger feed_items_set_updated_at before update on public.feed_items for each row execute function public.set_feed_updated_at();
drop trigger if exists feed_user_states_set_updated_at on public.feed_user_states;
create trigger feed_user_states_set_updated_at before update on public.feed_user_states for each row execute function public.set_feed_updated_at();

create or replace function public.can_view_feed_item(target_feed_item_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case item.source_type
      when 'text_message' then public.can_view_message(item.source_id)
      when 'radio_session' then public.can_view_radio_session(item.source_id)
      when 'radio_comment' then item.parent_source_id is not null and public.can_view_radio_session(item.parent_source_id)
      when 'podcast_episode' then public.can_view_podcast_episode(item.source_id)
      when 'podcast_comment' then item.parent_source_id is not null and public.can_view_podcast_episode(item.parent_source_id)
      else false
    end
    from public.feed_items item
    where item.id = target_feed_item_id
      and item.deleted_at is null
      and item.moderation_state = 'visible'
  ), false);
$$;

alter table public.feed_items enable row level security;
alter table public.feed_items force row level security;
alter table public.feed_engagement_rollups enable row level security;
alter table public.feed_engagement_rollups force row level security;
alter table public.feed_user_states enable row level security;
alter table public.feed_user_states force row level security;
alter table public.feed_impressions enable row level security;
alter table public.feed_impressions force row level security;

revoke all on table public.feed_items, public.feed_engagement_rollups, public.feed_user_states, public.feed_impressions from public, anon, authenticated;
grant select, insert, update, delete on table public.feed_user_states to authenticated;
grant select, insert, update on table public.feed_impressions to authenticated;

drop policy if exists feed_user_states_select_own on public.feed_user_states;
create policy feed_user_states_select_own on public.feed_user_states for select to authenticated
using (user_id = auth.uid() and public.can_view_feed_item(feed_item_id));
drop policy if exists feed_user_states_insert_own_visible on public.feed_user_states;
create policy feed_user_states_insert_own_visible on public.feed_user_states for insert to authenticated
with check (user_id = auth.uid() and public.can_view_feed_item(feed_item_id));
drop policy if exists feed_user_states_update_own_visible on public.feed_user_states;
create policy feed_user_states_update_own_visible on public.feed_user_states for update to authenticated
using (user_id = auth.uid() and public.can_view_feed_item(feed_item_id))
with check (user_id = auth.uid() and public.can_view_feed_item(feed_item_id));
drop policy if exists feed_user_states_delete_own on public.feed_user_states;
create policy feed_user_states_delete_own on public.feed_user_states for delete to authenticated
using (user_id = auth.uid());

drop policy if exists feed_impressions_select_own on public.feed_impressions;
create policy feed_impressions_select_own on public.feed_impressions for select to authenticated
using (user_id = auth.uid() and public.can_view_feed_item(feed_item_id));
drop policy if exists feed_impressions_insert_own_visible on public.feed_impressions;
create policy feed_impressions_insert_own_visible on public.feed_impressions for insert to authenticated
with check (user_id = auth.uid() and public.can_view_feed_item(feed_item_id));
drop policy if exists feed_impressions_update_own_visible on public.feed_impressions;
create policy feed_impressions_update_own_visible on public.feed_impressions for update to authenticated
using (user_id = auth.uid() and public.can_view_feed_item(feed_item_id))
with check (user_id = auth.uid() and public.can_view_feed_item(feed_item_id));

revoke all on function public.set_feed_updated_at(), public.can_view_feed_item(uuid) from public, anon;
grant execute on function public.can_view_feed_item(uuid) to authenticated;

comment on table public.feed_items is 'Canonical Feed source metadata only. Source bodies remain in their owning tables.';
comment on table public.feed_engagement_rollups is 'Rebuildable Feed Score V1 aggregates; clients cannot write canonical scores.';
comment on table public.feed_user_states is 'Per-user read/save/hide/seen/open state protected by source visibility.';
comment on table public.feed_impressions is 'Privacy-minimal Feed display/open metadata. Never stores message, radio, or podcast body content.';

