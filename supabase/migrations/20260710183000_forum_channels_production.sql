alter table public.forum_posts
  add column if not exists community_id uuid references public.communities(id) on delete cascade,
  add column if not exists parent_message_id uuid references public.messages(id) on delete cascade,
  add column if not exists thread_id uuid references public.threads(id) on delete cascade,
  add column if not exists body text not null default '' check(char_length(body) between 1 and 4000);
create unique index if not exists idx_forum_posts_parent_message on public.forum_posts(parent_message_id) where parent_message_id is not null;
create unique index if not exists idx_forum_posts_thread on public.forum_posts(thread_id) where thread_id is not null;
create or replace function public.can_create_forum_post(target_channel_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.channels channel where channel.id=target_channel_id and channel.type='forum' and public.can_view_channel(channel.id) and public.is_community_member(channel.community_id));
$$;
create or replace function public.can_reply_thread(target_thread_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.threads thread join public.channels channel on channel.id=thread.channel_id where thread.id=target_thread_id and thread.archived_at is null and public.can_view_thread(thread.id) and (public.can_send_message_to_channel(thread.channel_id) or (channel.type='forum' and public.is_community_member(channel.community_id))));
$$;
create or replace function public.create_forum_post(target_community_id uuid,target_channel_id uuid,post_title text,post_body text,post_tags text[] default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare root_message public.messages; created_thread public.threads; created_post public.forum_posts; normalized_tags text[];
begin
  if auth.uid() is null or not public.can_create_forum_post(target_channel_id) then raise exception 'FORUM_CREATE_FORBIDDEN'; end if;
  if not exists(select 1 from public.channels where id=target_channel_id and community_id=target_community_id and type='forum') then raise exception 'FORUM_CHANNEL_INVALID'; end if;
  post_title:=left(btrim(post_title),180); post_body:=left(btrim(post_body),4000);
  if post_title='' or post_body='' then raise exception 'FORUM_VALIDATION_ERROR'; end if;
  select coalesce(array_agg(tag),'{}') into normalized_tags from (select distinct left(btrim(value),30) tag from unnest(post_tags) value where btrim(value)<>'' limit 5) tags;
  insert into public.messages(community_id,channel_id,author_id,body,client_message_id) values(target_community_id,target_channel_id,auth.uid(),post_body,gen_random_uuid()) returning * into root_message;
  insert into public.threads(community_id,channel_id,parent_message_id,name,created_by) values(target_community_id,target_channel_id,root_message.id,post_title,auth.uid()) returning * into created_thread;
  insert into public.forum_posts(community_id,channel_id,parent_message_id,thread_id,title,body,author_id,tags) values(target_community_id,target_channel_id,root_message.id,created_thread.id,post_title,post_body,auth.uid(),normalized_tags) returning * into created_post;
  return to_jsonb(created_post);
end;
$$;
drop policy if exists "forum_posts_visible_select" on public.forum_posts;
create policy "forum_posts_visible_select" on public.forum_posts for select to authenticated using(public.can_view_channel(channel_id));
drop policy if exists "forum_posts_member_insert" on public.forum_posts;
revoke insert on public.forum_posts from authenticated;
grant execute on function public.can_create_forum_post(uuid),public.create_forum_post(uuid,uuid,text,text,text[]) to authenticated;
create index if not exists idx_forum_posts_search_order on public.forum_posts(channel_id,updated_at desc);
comment on table public.forum_posts is 'Forum metadata linked to one root message and one thread. Visibility follows the forum channel.';
