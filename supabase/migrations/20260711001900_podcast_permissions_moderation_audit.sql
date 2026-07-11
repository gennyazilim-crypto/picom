-- Task 458: hierarchy-aware Podcast permissions, moderation, reports, and append-only audit evidence.
begin;

update public.roles role
set permissions=coalesce(role.permissions,'{}'::jsonb)||case
  when lower(role.name) in ('owner','admin') or role.level>=80 then '{"createPodcastDrafts":true,"publishPodcasts":true,"editPodcastMetadata":true,"archivePodcastEpisodes":true,"moderatePodcastEpisodes":true,"managePodcastSeries":true,"moderatePodcastComments":true,"managePodcastCommunity":true}'::jsonb
  when lower(role.name)='podcast publisher' then '{"createPodcastDrafts":true,"publishPodcasts":true,"editPodcastMetadata":true,"archivePodcastEpisodes":true,"managePodcastSeries":true}'::jsonb
  when lower(role.name)='podcast editor' then '{"editPodcastMetadata":true,"moderatePodcastComments":true}'::jsonb
  when lower(role.name)='moderator' or role.level between 60 and 79 then '{"moderatePodcastComments":true}'::jsonb
  else '{}'::jsonb end
from public.communities community
where community.id=role.community_id and community.kind='podcast'::public.community_kind;

create or replace function public.can_manage_community_audio(target_community_id uuid, capability text default 'manageCommunity')
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when capability=any(array['hostRadio','manageRadioCommunity','manageRadioSchedule','manageRadioPrograms','publishRadioAnnouncements','moderateRadioComments','listenRadio'])
      then public.can_manage_community_kind(target_community_id,'radio'::public.community_kind,capability)
    when capability=any(array['createPodcastDrafts','publishPodcasts','editPodcastMetadata','archivePodcastEpisodes','moderatePodcastEpisodes','managePodcastSeries','commentOnPodcasts','reactToPodcasts','moderatePodcastComments','managePodcastCommunity','listenPodcasts'])
      then public.can_manage_community_kind(target_community_id,'podcast'::public.community_kind,capability)
    else false
  end;
$$;

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check(target_type in('message','user','community','podcast_episode','podcast_comment'));
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check(reason in('spam','harassment','unsafe_content','impersonation','copyright','other'));

create or replace function public.can_report_podcast_target(target_community_id uuid,target_type text,target_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when target_type='podcast_episode' then exists(select 1 from public.podcast_episodes episode where episode.id=target_id and episode.community_id=target_community_id and public.can_view_podcast_episode(episode.id))
    when target_type='podcast_comment' then exists(select 1 from public.podcast_episode_comments comment join public.podcast_episodes episode on episode.id=comment.episode_id where comment.id=target_id and comment.deleted_at is null and episode.community_id=target_community_id and public.can_view_podcast_episode(episode.id))
    else true
  end;
$$;

create or replace function public.can_review_community_report(target_community_id uuid,target_type text)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when target_type='podcast_comment' then public.can_manage_community_audio(target_community_id,'moderatePodcastComments') or public.can_manage_community_audio(target_community_id,'moderatePodcastEpisodes')
    when target_type='podcast_episode' then public.can_manage_community_audio(target_community_id,'moderatePodcastEpisodes')
    else public.can_moderate_community_reports(target_community_id)
  end;
$$;

drop policy if exists "reports_submit_visible_target" on public.reports;
drop policy if exists "reports_submit_authorized_target" on public.reports;
create policy "reports_submit_authorized_target" on public.reports for insert to authenticated with check(
  reporter_id=auth.uid() and community_id is not null
  and exists(select 1 from public.communities community where community.id=reports.community_id and (community.visibility='public' or public.is_community_member(community.id)))
  and public.can_report_podcast_target(community_id,target_type,target_id)
);
drop policy if exists "reports_moderator_select" on public.reports;
drop policy if exists "reports_authorized_reviewer_select" on public.reports;
create policy "reports_authorized_reviewer_select" on public.reports for select to authenticated using(community_id is not null and public.can_review_community_report(community_id,target_type));
drop policy if exists "reports_moderator_update" on public.reports;
drop policy if exists "reports_authorized_reviewer_update" on public.reports;
create policy "reports_authorized_reviewer_update" on public.reports for update to authenticated using(community_id is not null and public.can_review_community_report(community_id,target_type)) with check(community_id is not null and public.can_review_community_report(community_id,target_type));

drop policy if exists "podcast comments follow unblocked episode visibility" on public.podcast_episode_comments;
create policy "podcast comments follow unblocked episode visibility" on public.podcast_episode_comments for select to authenticated using(deleted_at is null and public.can_view_podcast_episode(episode_id) and (author_id is null or author_id=auth.uid() or not public.users_are_blocked(auth.uid(),author_id)));

create or replace function public.moderate_podcast_comment(target_comment_id uuid,moderation_reason text)
returns boolean language plpgsql security definer set search_path=public as $$
declare target_comment public.podcast_episode_comments%rowtype; target_episode public.podcast_episodes%rowtype;
begin
  if auth.uid() is null then raise exception 'PODCAST_MODERATION_AUTH_REQUIRED' using errcode='42501'; end if;
  if char_length(btrim(moderation_reason))<10 or char_length(moderation_reason)>500 then raise exception 'PODCAST_MODERATION_REASON_INVALID' using errcode='22023'; end if;
  select * into target_comment from public.podcast_episode_comments comment where comment.id=target_comment_id and comment.deleted_at is null for update;
  select * into target_episode from public.podcast_episodes episode where episode.id=target_comment.episode_id;
  if target_comment.id is null or target_episode.id is null then raise exception 'PODCAST_COMMENT_NOT_FOUND' using errcode='P0002'; end if;
  if not public.can_manage_community_audio(target_episode.community_id,'moderatePodcastComments') then raise exception 'PODCAST_COMMENT_MODERATION_DENIED' using errcode='42501'; end if;
  update public.podcast_episode_comments set deleted_at=now() where id=target_comment.id;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_episode.community_id,auth.uid(),'moderation_action','podcast_comment',target_comment.id,public.redact_audit_reason(moderation_reason));
  return true;
end;
$$;

create or replace function public.moderate_podcast_episode(target_episode_id uuid,moderation_action text,moderation_reason text)
returns setof public.podcast_episodes language plpgsql security definer set search_path=public as $$
declare target_episode public.podcast_episodes%rowtype;
begin
  if auth.uid() is null then raise exception 'PODCAST_MODERATION_AUTH_REQUIRED' using errcode='42501'; end if;
  if moderation_action not in('unpublish','archive') then raise exception 'PODCAST_MODERATION_ACTION_INVALID' using errcode='22023'; end if;
  if char_length(btrim(moderation_reason))<10 or char_length(moderation_reason)>500 then raise exception 'PODCAST_MODERATION_REASON_INVALID' using errcode='22023'; end if;
  select * into target_episode from public.podcast_episodes episode where episode.id=target_episode_id for update;
  if target_episode.id is null then raise exception 'PODCAST_EPISODE_NOT_FOUND' using errcode='P0002'; end if;
  if not public.can_manage_community_audio(target_episode.community_id,'moderatePodcastEpisodes') then raise exception 'PODCAST_EPISODE_MODERATION_DENIED' using errcode='42501'; end if;
  if moderation_action='unpublish' and target_episode.status<>'published' then raise exception 'PODCAST_EPISODE_NOT_PUBLISHED' using errcode='22023'; end if;
  if moderation_action='archive' and target_episode.status='archived' then raise exception 'PODCAST_EPISODE_ALREADY_ARCHIVED' using errcode='22023'; end if;
  update public.podcast_episodes set status=case when moderation_action='archive' then 'archived' else 'draft' end,published_at=case when moderation_action='unpublish' then null else published_at end where id=target_episode.id returning * into target_episode;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_episode.community_id,auth.uid(),'moderation_action','podcast_episode',target_episode.id,public.redact_audit_reason(moderation_action||': '||moderation_reason));
  return next target_episode;
end;
$$;

create or replace function public.audit_podcast_episode_lifecycle()
returns trigger language plpgsql security definer set search_path=public as $$
declare event_target text; event_reason text; target_community uuid; target_id uuid;
begin
  if auth.uid() is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then event_target:='podcast_episode_delete';event_reason:='Podcast episode deleted';target_community:=old.community_id;target_id:=old.id;
  elsif old.status is distinct from new.status then
    target_community:=new.community_id;target_id:=new.id;
    if new.status='published' then event_target:='podcast_episode_publish';event_reason:='Podcast episode published';
    elsif new.status='archived' then event_target:='podcast_episode_archive';event_reason:='Podcast episode archived';
    elsif old.status='published' and new.status='draft' then event_target:='podcast_episode_unpublish';event_reason:='Podcast episode returned to draft'; end if;
  end if;
  if event_target is not null then insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community,auth.uid(),'community_update',event_target,target_id,event_reason); end if;
  if tg_op='DELETE' then return old; end if; return new;
end;
$$;
drop trigger if exists podcast_episode_lifecycle_audit on public.podcast_episodes;
create trigger podcast_episode_lifecycle_audit after update of status or delete on public.podcast_episodes for each row execute function public.audit_podcast_episode_lifecycle();

create or replace function public.prepare_podcast_report_review()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.target_type in('podcast_episode','podcast_comment') or new.target_type in('podcast_episode','podcast_comment') then
    if new.community_id is distinct from old.community_id or new.reporter_id is distinct from old.reporter_id or new.target_type is distinct from old.target_type or new.target_id is distinct from old.target_id or new.reason is distinct from old.reason or new.description is distinct from old.description or new.created_at is distinct from old.created_at then raise exception 'PODCAST_REPORT_IDENTITY_IMMUTABLE' using errcode='42501'; end if;
    if old.status is distinct from new.status then
      if not ((old.status='open' and new.status in('reviewed','dismissed','action_taken')) or (old.status='reviewed' and new.status in('dismissed','action_taken'))) then raise exception 'PODCAST_REPORT_STATUS_TRANSITION_INVALID' using errcode='22023'; end if;
      if not public.can_review_community_report(new.community_id,new.target_type) then raise exception 'PODCAST_REPORT_REVIEW_DENIED' using errcode='42501'; end if;
      new.reviewed_by:=auth.uid();new.reviewed_at:=now();new.updated_at:=now();
    end if;
  end if;
  return new;
end;
$$;
create or replace function public.audit_podcast_report_review()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.target_type in('podcast_episode','podcast_comment') and old.status is distinct from new.status and auth.uid() is not null then insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(new.community_id,auth.uid(),'moderation_action','podcast_report',new.id,'Podcast report marked '||new.status); end if;
  return new;
end;
$$;
drop trigger if exists podcast_report_review_prepare on public.reports;
create trigger podcast_report_review_prepare before update of status on public.reports for each row execute function public.prepare_podcast_report_review();
drop trigger if exists podcast_report_review_audit on public.reports;
create trigger podcast_report_review_audit after update of status on public.reports for each row execute function public.audit_podcast_report_review();

revoke all on function public.can_report_podcast_target(uuid,text,uuid),public.can_review_community_report(uuid,text),public.moderate_podcast_comment(uuid,text),public.moderate_podcast_episode(uuid,text,text),public.audit_podcast_episode_lifecycle(),public.prepare_podcast_report_review(),public.audit_podcast_report_review() from public,anon;
grant execute on function public.can_report_podcast_target(uuid,text,uuid),public.can_review_community_report(uuid,text),public.moderate_podcast_comment(uuid,text),public.moderate_podcast_episode(uuid,text,text) to authenticated;
comment on function public.moderate_podcast_comment(uuid,text) is 'Permission-checked soft deletion with append-only Podcast moderation audit evidence.';
comment on function public.moderate_podcast_episode(uuid,text,text) is 'Owner/admin Podcast policy action; supports unpublish/archive and records bounded audit evidence.';

commit;
