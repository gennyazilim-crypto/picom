create table if not exists public.community_moderation_settings (
  community_id uuid primary key references public.communities(id) on delete cascade,
  blocked_words text[] not null default '{}',
  max_mentions_per_message integer not null default 8 check (max_mentions_per_message between 1 and 50),
  block_links boolean not null default false,
  slow_mode_seconds integer not null default 0 check (slow_mode_seconds between 0 and 21600),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.community_moderation_settings enable row level security;
grant select, insert, update on public.community_moderation_settings to authenticated;
create policy "moderation_settings_manager_select" on public.community_moderation_settings for select to authenticated using (public.can_moderate_community_reports(community_id));
create policy "moderation_settings_manager_insert" on public.community_moderation_settings for insert to authenticated with check (public.can_moderate_community_reports(community_id));
create policy "moderation_settings_manager_update" on public.community_moderation_settings for update to authenticated using (public.can_moderate_community_reports(community_id)) with check (public.can_moderate_community_reports(community_id));
create or replace function public.validate_message_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_community_id uuid;
  settings public.community_moderation_settings%rowtype;
  mention_count integer;
begin
  select channel.community_id into target_community_id from public.channels channel where channel.id = new.channel_id;
  select * into settings from public.community_moderation_settings item where item.community_id = target_community_id;
  if not found then return new; end if;

  if exists (select 1 from unnest(settings.blocked_words) word where word <> '' and position(lower(word) in lower(new.body)) > 0) then raise exception 'message blocked by community word filter'; end if;
  select count(*) into mention_count from regexp_matches(new.body, '@[A-Za-z0-9_]+', 'g');
  if mention_count > settings.max_mentions_per_message then raise exception 'message exceeds community mention limit'; end if;
  if settings.block_links and new.body ~* '(https?://|www\.)' then raise exception 'links are blocked in this community'; end if;
  if settings.slow_mode_seconds > 0 and exists (select 1 from public.messages message where message.channel_id = new.channel_id and message.author_id = new.author_id and message.created_at > now() - make_interval(secs => settings.slow_mode_seconds)) then raise exception 'community slow mode is active'; end if;
  return new;
end;
$$;
drop trigger if exists messages_moderation_guard on public.messages;
create trigger messages_moderation_guard before insert on public.messages for each row execute function public.validate_message_moderation();
