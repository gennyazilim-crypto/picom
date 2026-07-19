alter table public.profiles
  add column if not exists dm_privacy text not null default 'everyone';
alter table public.profiles drop constraint if exists profiles_dm_privacy_check;
alter table public.profiles add constraint profiles_dm_privacy_check
  check (dm_privacy in ('everyone','friends','no_one'));

create or replace function public.is_direct_conversation_participant(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.direct_conversation_participants own
      where own.conversation_id=target_conversation_id and own.user_id=auth.uid()
    )
    and not exists (
      select 1 from public.direct_conversation_participants other
      where other.conversation_id=target_conversation_id and other.user_id<>auth.uid()
        and public.users_are_blocked(auth.uid(),other.user_id)
    );
$$;

create or replace function public.get_direct_message_privacy()
returns text language sql stable security definer set search_path=public as $$
  select profile.dm_privacy from public.profiles profile where profile.id=auth.uid();
$$;

create or replace function public.update_direct_message_privacy(next_privacy text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if next_privacy not in ('everyone','friends','no_one') then raise exception 'DM_PRIVACY_INVALID' using errcode='22023'; end if;
  update public.profiles set dm_privacy=next_privacy,updated_at=now() where id=auth.uid();
  return found;
end;
$$;

revoke all on function public.get_direct_message_privacy(),public.update_direct_message_privacy(text) from public,anon;
grant execute on function public.get_direct_message_privacy(),public.update_direct_message_privacy(text) to authenticated;

drop trigger if exists direct_messages_user_rate_limit on public.direct_messages;
create trigger direct_messages_user_rate_limit before insert on public.direct_messages
  for each row execute function public.enforce_current_user_action_rate_limit('message_send');
drop trigger if exists direct_message_attachments_user_rate_limit on public.direct_message_attachments;
create trigger direct_message_attachments_user_rate_limit before insert on public.direct_message_attachments
  for each row execute function public.enforce_current_user_action_rate_limit('attachment_metadata');
drop trigger if exists direct_message_reactions_user_rate_limit on public.direct_message_reactions;
create trigger direct_message_reactions_user_rate_limit before insert or delete on public.direct_message_reactions
  for each row execute function public.enforce_current_user_action_rate_limit('reaction_write');

drop policy if exists "friend_requests_insert_sender" on public.friend_requests;
drop policy if exists "friend_requests_insert_sender" on public.friend_requests;
create policy "friend_requests_insert_sender" on public.friend_requests for insert to authenticated
with check (
  sender_id=auth.uid() and status='pending'
  and not public.users_are_blocked(sender_id,recipient_id)
);

alter table public.reports add column if not exists conversation_id uuid references public.direct_conversations(id) on delete set null;
alter table public.reports add column if not exists evidence_excerpt text;
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('message','direct_message','user','community','podcast_episode','podcast_comment'));
alter table public.reports drop constraint if exists reports_evidence_excerpt_check;
alter table public.reports add constraint reports_evidence_excerpt_check
  check (evidence_excerpt is null or char_length(evidence_excerpt)<=280);
create index if not exists idx_reports_conversation_status_created
  on public.reports(conversation_id,status,created_at desc) where conversation_id is not null;

create or replace function public.submit_safety_report(
  report_target_type text,
  report_target_id uuid,
  report_reason text,
  report_description text default null,
  report_community_id uuid default null,
  report_conversation_id uuid default null
)
returns setof public.reports language plpgsql security definer set search_path=public as $$
declare
  report_id uuid;
  valid_context boolean:=false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if report_target_type not in ('message','direct_message','user','community','podcast_episode','podcast_comment')
    or report_reason not in ('spam','harassment','unsafe_content','impersonation','copyright','other')
    or report_target_id is null then raise exception 'REPORT_INPUT_INVALID' using errcode='22023'; end if;
  if (select count(*) from public.reports where reporter_id=auth.uid() and created_at>now()-interval '10 minutes')>=5
    or (select count(*) from public.reports where reporter_id=auth.uid() and created_at>now()-interval '24 hours')>=25
  then raise exception 'REPORT_RATE_LIMITED' using errcode='P0001'; end if;

  if report_conversation_id is not null then
    if report_target_type='direct_message' then
      select exists(
        select 1 from public.direct_messages message
        join public.direct_conversation_participants participant on participant.conversation_id=message.conversation_id
        where message.id=report_target_id and message.conversation_id=report_conversation_id and participant.user_id=auth.uid()
      ) into valid_context;
    elsif report_target_type='user' then
      select exists(
        select 1 from public.direct_conversation_participants own
        join public.direct_conversation_participants target on target.conversation_id=own.conversation_id
        where own.conversation_id=report_conversation_id and own.user_id=auth.uid()
          and target.user_id=report_target_id and target.user_id<>auth.uid()
      ) into valid_context;
    end if;
  elsif report_community_id is not null then
    if report_target_type='community' then
      select exists(select 1 from public.communities community where community.id=report_target_id and community.id=report_community_id and (community.visibility='public' or public.is_community_member(community.id))) into valid_context;
    elsif report_target_type='message' then
      select exists(select 1 from public.messages message join public.channels channel on channel.id=message.channel_id where message.id=report_target_id and channel.community_id=report_community_id and public.can_view_channel(channel.id)) into valid_context;
    elsif report_target_type='user' then
      select exists(select 1 from public.community_members member where member.community_id=report_community_id and member.user_id=report_target_id and (public.is_community_member(report_community_id) or public.can_read_public_community(report_community_id))) into valid_context;
    elsif report_target_type in ('podcast_episode','podcast_comment') then
      select exists(select 1 from public.communities community where community.id=report_community_id and (community.visibility='public' or public.is_community_member(community.id))) into valid_context;
    end if;
  end if;

  if not valid_context then raise exception 'REPORT_TARGET_FORBIDDEN' using errcode='42501'; end if;
  insert into public.reports(community_id,conversation_id,reporter_id,target_type,target_id,reason,description,evidence_excerpt,status)
  values(report_community_id,report_conversation_id,auth.uid(),report_target_type,report_target_id,report_reason,left(coalesce(nullif(btrim(report_description),''),'No additional details provided.'),1000),null,'open')
  returning id into report_id;
  return query select report.* from public.reports report where report.id=report_id;
end;
$$;

drop policy if exists "reports_submit_visible_target" on public.reports;
drop policy if exists "reports_requester_select" on public.reports;
drop policy if exists "reports_requester_select" on public.reports;
create policy "reports_requester_select" on public.reports for select to authenticated using(reporter_id=auth.uid());
drop policy if exists "reports_moderator_select" on public.reports;
drop policy if exists "reports_moderator_select" on public.reports;
create policy "reports_moderator_select" on public.reports for select to authenticated
using((community_id is not null and public.can_moderate_community_reports(community_id)) or (conversation_id is not null and public.is_app_admin()));
drop policy if exists "reports_moderator_update" on public.reports;
drop policy if exists "reports_moderator_update" on public.reports;
create policy "reports_moderator_update" on public.reports for update to authenticated
using((community_id is not null and public.can_moderate_community_reports(community_id)) or (conversation_id is not null and public.is_app_admin()))
with check(((community_id is not null and public.can_moderate_community_reports(community_id)) or (conversation_id is not null and public.is_app_admin())) and (reviewed_by is null or reviewed_by=auth.uid()));

revoke insert on public.reports from authenticated;
revoke all on function public.submit_safety_report(text,uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.submit_safety_report(text,uuid,text,text,uuid,uuid) to authenticated;

comment on function public.submit_safety_report(text,uuid,text,text,uuid,uuid) is 'Rate-limited report submission. DM reports persist only the selected target ID and sanitized reporter description, never a conversation transcript or unrelated private content.';
comment on column public.reports.conversation_id is 'Optional participant-authorized DM context. App-admin review only.';;
