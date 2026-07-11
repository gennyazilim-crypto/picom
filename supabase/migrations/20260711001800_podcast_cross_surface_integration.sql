-- Task 457: Podcast exact-source notifications and cross-surface routing metadata.
begin;

alter table public.notifications
  add column if not exists podcast_episode_id uuid references public.podcast_episodes(id) on delete set null;

create index if not exists notifications_recipient_podcast_idx
  on public.notifications(recipient_id,podcast_episode_id,created_at desc)
  where podcast_episode_id is not null and deleted_at is null;

create or replace function public.enqueue_podcast_mentions(
  target_episode_id uuid,
  target_actor_id uuid,
  mention_body text,
  source_kind text,
  source_id text
)
returns void language plpgsql security definer set search_path=public as $$
declare
  target_episode public.podcast_episodes%rowtype;
  target_community public.communities%rowtype;
  actor_name text;
  mention_username text;
  recipient_id uuid;
begin
  if target_actor_id is null or coalesce(btrim(mention_body),'')='' then return; end if;
  select * into target_episode from public.podcast_episodes episode where episode.id=target_episode_id and episode.status='published';
  if not found then return; end if;
  select * into target_community from public.communities community where community.id=target_episode.community_id;
  if not found then return; end if;
  select profile.display_name into actor_name from public.profiles profile where profile.id=target_actor_id;

  for mention_username in
    select distinct lower(matches[1])
    from regexp_matches(mention_body,'@([A-Za-z0-9_.-]{1,64})','g') as matches
  loop
    for recipient_id in
      select profile.id
      from public.profiles profile
      join public.community_members member on member.community_id=target_episode.community_id and member.user_id=profile.id
      where lower(profile.username)=mention_username
        and profile.id<>target_actor_id
        and not public.users_are_blocked(profile.id,target_actor_id)
    loop
      insert into public.notifications(
        recipient_id,actor_id,category,title,preview,context_kind,context_label,
        community_id,podcast_episode_id,user_id,source_event_id
      ) values (
        recipient_id,target_actor_id,'mention',coalesce(actor_name,'A community member')||' mentioned you in a Podcast',
        left(regexp_replace(mention_body,'\s+',' ','g'),500),'community',
        left(target_community.name||' / '||target_episode.title,160),target_episode.community_id,
        target_episode.id,target_actor_id,
        'podcast:'||source_kind||':'||source_id||':'||recipient_id::text||':'||md5(mention_body)
      ) on conflict (recipient_id,source_event_id) where source_event_id is not null do nothing;
    end loop;
  end loop;
end;
$$;

create or replace function public.notify_podcast_description_mentions()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status<>'published' then return new; end if;
  if tg_op='INSERT' then
    perform public.enqueue_podcast_mentions(new.id,new.author_user_id,new.description,'episode-description',new.id::text);
  elsif old.status is distinct from new.status or old.description is distinct from new.description then
    perform public.enqueue_podcast_mentions(new.id,new.author_user_id,new.description,'episode-description',new.id::text);
  end if;
  return new;
end;
$$;

create or replace function public.notify_podcast_comment_mentions()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.deleted_at is not null or new.author_id is null then return new; end if;
  if tg_op='INSERT' then
    perform public.enqueue_podcast_mentions(new.episode_id,new.author_id,new.body,'episode-comment',new.id::text);
  elsif old.body is distinct from new.body then
    perform public.enqueue_podcast_mentions(new.episode_id,new.author_id,new.body,'episode-comment',new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists podcast_description_mentions_notify on public.podcast_episodes;
create trigger podcast_description_mentions_notify after insert or update of status,description on public.podcast_episodes for each row execute function public.notify_podcast_description_mentions();
drop trigger if exists podcast_comment_mentions_notify on public.podcast_episode_comments;
create trigger podcast_comment_mentions_notify after insert or update of body,deleted_at on public.podcast_episode_comments for each row execute function public.notify_podcast_comment_mentions();

revoke all on function public.enqueue_podcast_mentions(uuid,uuid,text,text,text),public.notify_podcast_description_mentions(),public.notify_podcast_comment_mentions() from public,anon,authenticated;
comment on column public.notifications.podcast_episode_id is 'Exact Podcast episode route. Recipient RLS and episode access are rechecked by the renderer service before navigation.';
comment on function public.enqueue_podcast_mentions(uuid,uuid,text,text,text) is 'Internal trigger-only producer for authorized Podcast description/comment mentions; stores bounded metadata, never private audio URLs.';

commit;
