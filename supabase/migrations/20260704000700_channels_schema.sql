-- Channels table schema hardening
-- Keeps text and voice channel records predictable for the desktop MVP.

alter table public.channels
  add constraint channels_name_length check (char_length(name) between 1 and 80),
  add constraint channels_topic_length check (topic is null or char_length(topic) <= 300),
  add constraint channels_position_range check (position between 0 and 10000);
create unique index if not exists channels_community_lower_name_unique
  on public.channels (community_id, lower(name));
create index if not exists idx_channels_category_position
  on public.channels(category_id, position);
create index if not exists idx_channels_community_type_position
  on public.channels(community_id, type, position);
create index if not exists idx_channels_community_private
  on public.channels(community_id, is_private);
create or replace function public.ensure_channel_category_matches_community()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1
    from public.channel_categories category
    where category.id = new.category_id
      and category.community_id = new.community_id
  ) then
    raise exception 'category_id must belong to the same community' using errcode = '23514';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_channels_category_matches_community on public.channels;
create trigger trg_channels_category_matches_community
before insert or update of community_id, category_id on public.channels
for each row
execute function public.ensure_channel_category_matches_community();
