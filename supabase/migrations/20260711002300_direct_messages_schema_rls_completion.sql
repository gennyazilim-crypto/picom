-- Complete one-to-one DM integrity, participant RLS, lifecycle guards, and private Storage access.
begin;

alter table public.direct_conversations
  add column if not exists participant_low_id uuid references public.profiles(id) on delete restrict,
  add column if not exists participant_high_id uuid references public.profiles(id) on delete restrict,
  add column if not exists superseded_by uuid references public.direct_conversations(id) on delete restrict;

with paired as (
  select conversation.id,conversation.created_at,
    least(first_participant.user_id,second_participant.user_id) participant_low_id,
    greatest(first_participant.user_id,second_participant.user_id) participant_high_id
  from public.direct_conversations conversation
  join public.direct_conversation_participants first_participant on first_participant.conversation_id=conversation.id
  join public.direct_conversation_participants second_participant on second_participant.conversation_id=conversation.id and first_participant.user_id<second_participant.user_id
  where conversation.type='direct'
    and (select count(*) from public.direct_conversation_participants participant where participant.conversation_id=conversation.id)=2
), ranked as (
  select paired.*,
    row_number() over(partition by participant_low_id,participant_high_id order by created_at,id) pair_rank,
    first_value(id) over(partition by participant_low_id,participant_high_id order by created_at,id) canonical_id
  from paired
)
update public.direct_conversations conversation
set participant_low_id=case when ranked.pair_rank=1 then ranked.participant_low_id else null end,
    participant_high_id=case when ranked.pair_rank=1 then ranked.participant_high_id else null end,
    superseded_by=case when ranked.pair_rank=1 then null else ranked.canonical_id end
from ranked where conversation.id=ranked.id;

update public.direct_conversation_participants participant
set archived_at=coalesce(participant.archived_at,now())
from public.direct_conversations conversation
where participant.conversation_id=conversation.id and conversation.superseded_by is not null;

alter table public.direct_conversations drop constraint if exists direct_conversations_pair_check;
alter table public.direct_conversations add constraint direct_conversations_pair_check check (
  (participant_low_id is null and participant_high_id is null)
  or (participant_low_id is not null and participant_high_id is not null and participant_low_id<participant_high_id)
);
create unique index if not exists direct_conversations_unique_active_pair_idx
  on public.direct_conversations(participant_low_id,participant_high_id)
  where participant_low_id is not null and participant_high_id is not null and superseded_by is null;
create index if not exists direct_conversations_superseded_idx on public.direct_conversations(superseded_by) where superseded_by is not null;

alter table public.direct_conversation_participants
  add column if not exists last_read_message_id uuid references public.direct_messages(id) on delete set null;
create index if not exists direct_participants_user_archive_idx
  on public.direct_conversation_participants(user_id,archived_at,conversation_id);

update public.direct_messages set deleted_at=coalesce(deleted_at,updated_at,now()),body=null
where deleted_at is null and (body is null or btrim(body)='');
update public.direct_messages set body=null where deleted_at is not null;

alter table public.direct_messages drop constraint if exists direct_messages_content_check;
alter table public.direct_messages add constraint direct_messages_content_check check (
  (deleted_at is null and body is not null and char_length(btrim(body)) between 1 and 4000)
  or (deleted_at is not null and body is null)
);
alter table public.direct_messages drop constraint if exists direct_messages_client_id_content_check;
alter table public.direct_messages add constraint direct_messages_client_id_content_check check (
  client_message_id is null or char_length(btrim(client_message_id)) between 1 and 120
);
alter table public.direct_messages drop constraint if exists direct_messages_lifecycle_time_check;
alter table public.direct_messages add constraint direct_messages_lifecycle_time_check check (
  (edited_at is null or edited_at>=created_at) and (deleted_at is null or deleted_at>=created_at)
);

alter table public.direct_message_reactions drop constraint if exists direct_message_reactions_emoji_content_check;
alter table public.direct_message_reactions add constraint direct_message_reactions_emoji_content_check
  check (char_length(btrim(emoji)) between 1 and 64);
alter table public.direct_message_attachments drop constraint if exists direct_message_attachments_mime_type_safe_check;
alter table public.direct_message_attachments add constraint direct_message_attachments_mime_type_safe_check check (
  mime_type is null or mime_type in ('image/png','image/jpeg','image/webp','image/gif')
);
create unique index if not exists direct_message_attachments_storage_path_idx
  on public.direct_message_attachments(storage_path) where storage_path is not null;

create or replace function public.enforce_direct_conversation_two_members()
returns trigger language plpgsql security definer set search_path=public as $$
declare conversation public.direct_conversations;
begin
  select * into conversation from public.direct_conversations where id=new.conversation_id;
  if conversation.id is null or conversation.superseded_by is not null then raise exception 'DM_CONVERSATION_INACTIVE'; end if;
  if conversation.participant_low_id is not null and new.user_id not in(conversation.participant_low_id,conversation.participant_high_id) then raise exception 'DM_PARTICIPANT_PAIR_MISMATCH'; end if;
  if (select count(*) from public.direct_conversation_participants where conversation_id=new.conversation_id)>=2 then raise exception 'GROUP_DM_NOT_SUPPORTED'; end if;
  return new;
end;
$$;
drop trigger if exists direct_conversation_two_member_limit on public.direct_conversation_participants;
create trigger direct_conversation_two_member_limit before insert on public.direct_conversation_participants for each row execute function public.enforce_direct_conversation_two_members();

create or replace function public.sync_direct_conversation_pair()
returns trigger language plpgsql security definer set search_path=public as $$
declare participants uuid[]; conversation public.direct_conversations;
begin
  select * into conversation from public.direct_conversations where id=new.conversation_id;
  if conversation.superseded_by is not null then return new; end if;
  select array_agg(user_id order by user_id) into participants from public.direct_conversation_participants where conversation_id=new.conversation_id;
  if cardinality(participants)=2 then
    if conversation.participant_low_id is not null and (conversation.participant_low_id<>participants[1] or conversation.participant_high_id<>participants[2]) then raise exception 'DM_PARTICIPANT_PAIR_MISMATCH'; end if;
    update public.direct_conversations set participant_low_id=participants[1],participant_high_id=participants[2] where id=new.conversation_id;
  end if;
  return new;
end;
$$;
drop trigger if exists direct_conversation_pair_sync on public.direct_conversation_participants;
create trigger direct_conversation_pair_sync after insert on public.direct_conversation_participants for each row execute function public.sync_direct_conversation_pair();

create or replace function public.can_send_direct_message(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_direct_conversation_participant(target_conversation_id)
    and exists(select 1 from public.direct_conversations conversation where conversation.id=target_conversation_id and conversation.type='direct' and conversation.superseded_by is null and conversation.participant_low_id is not null)
    and (select count(*) from public.direct_conversation_participants where conversation_id=target_conversation_id)=2
    and exists(select 1 from public.direct_conversation_participants own where own.conversation_id=target_conversation_id and own.user_id=auth.uid() and own.blocked_at is null)
    and not exists(select 1 from public.direct_conversation_participants participant where participant.conversation_id=target_conversation_id and participant.blocked_at is not null)
    and not exists(select 1 from public.direct_conversation_participants other where other.conversation_id=target_conversation_id and other.user_id<>auth.uid() and public.users_are_blocked(auth.uid(),other.user_id));
$$;

create or replace function public.create_direct_conversation(other_user_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_conversation_id uuid; low_id uuid; high_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if other_user_id is null or other_user_id=auth.uid() then raise exception 'DM_PARTICIPANT_INVALID' using errcode='22023'; end if;
  if not public.can_user_receive_dm(auth.uid(),other_user_id) then raise exception 'DM_PRIVACY_DENIED' using errcode='42501'; end if;
  low_id:=least(auth.uid(),other_user_id); high_id:=greatest(auth.uid(),other_user_id);
  perform pg_advisory_xact_lock(hashtextextended(low_id::text||':'||high_id::text,0));
  select id into new_conversation_id from public.direct_conversations where participant_low_id=low_id and participant_high_id=high_id and superseded_by is null limit 1;
  if new_conversation_id is not null then return new_conversation_id; end if;
  begin
    insert into public.direct_conversations(created_by,participant_low_id,participant_high_id) values(auth.uid(),low_id,high_id) returning id into new_conversation_id;
  exception when unique_violation then
    select id into new_conversation_id from public.direct_conversations where participant_low_id=low_id and participant_high_id=high_id and superseded_by is null limit 1;
    return new_conversation_id;
  end;
  insert into public.direct_conversation_participants(conversation_id,user_id) values(new_conversation_id,auth.uid()),(new_conversation_id,other_user_id);
  return new_conversation_id;
end;
$$;

create or replace function public.validate_direct_message_reply_target()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.reply_to_message_id=new.id then raise exception 'DM_REPLY_TARGET_INVALID'; end if;
  if new.reply_to_message_id is not null and not exists(select 1 from public.direct_messages parent where parent.id=new.reply_to_message_id and parent.conversation_id=new.conversation_id) then raise exception 'DM_REPLY_TARGET_INVALID'; end if;
  return new;
end;
$$;

create or replace function public.enforce_direct_message_lifecycle()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    new.body:=nullif(btrim(new.body),'');
    new.updated_at:=new.created_at;
    return new;
  end if;
  if new.conversation_id<>old.conversation_id or new.author_id<>old.author_id or new.created_at<>old.created_at or new.client_message_id is distinct from old.client_message_id then raise exception 'DM_MESSAGE_IDENTITY_IMMUTABLE'; end if;
  if new.reply_to_message_id is distinct from old.reply_to_message_id then raise exception 'DM_REPLY_IMMUTABLE'; end if;
  if old.deleted_at is not null then raise exception 'DM_MESSAGE_DELETED'; end if;
  if new.deleted_at is not null then new.deleted_at:=greatest(new.deleted_at,old.created_at);new.body:=null;new.edited_at:=old.edited_at;new.updated_at:=now();return new;end if;
  if new.body is distinct from old.body then
    if not public.can_send_direct_message(old.conversation_id) then raise exception 'DM_EDIT_FORBIDDEN'; end if;
    new.body:=nullif(btrim(new.body),'');new.edited_at:=now();new.updated_at:=now();
  else
    new.edited_at:=old.edited_at;new.updated_at:=old.updated_at;
  end if;
  return new;
end;
$$;
drop trigger if exists direct_message_lifecycle_guard on public.direct_messages;
create trigger direct_message_lifecycle_guard before insert or update on public.direct_messages for each row execute function public.enforce_direct_message_lifecycle();

create or replace function public.set_direct_attachment_uploader()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null then
    if new.uploader_id is null then new.uploader_id:=auth.uid(); end if;
    if new.uploader_id<>auth.uid() then raise exception 'DM_ATTACHMENT_UPLOADER_INVALID'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists direct_attachment_uploader_guard on public.direct_message_attachments;
create trigger direct_attachment_uploader_guard before insert on public.direct_message_attachments for each row execute function public.set_direct_attachment_uploader();

create or replace function public.send_direct_message_v2(target_conversation_id uuid,message_body text,target_client_message_id text,target_reply_to_message_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.direct_messages;
begin
  message_body:=left(btrim(coalesce(message_body,'')),4000);
  if auth.uid() is null or message_body='' or not public.can_send_direct_message(target_conversation_id) then raise exception 'DM_SEND_FORBIDDEN' using errcode='42501'; end if;
  insert into public.direct_messages(conversation_id,author_id,body,client_message_id,reply_to_message_id)
  values(target_conversation_id,auth.uid(),message_body,left(nullif(btrim(target_client_message_id),''),120),target_reply_to_message_id)
  on conflict(author_id,client_message_id) where client_message_id is not null do nothing
  returning * into result;
  if result.id is null then
    select * into result from public.direct_messages where author_id=auth.uid() and client_message_id=left(nullif(btrim(target_client_message_id),''),120) limit 1;
  end if;
  update public.direct_conversation_participants set archived_at=null where conversation_id=target_conversation_id;
  return to_jsonb(result);
end;
$$;
create or replace function public.send_direct_message(target_conversation_id uuid,message_body text,target_client_message_id text)
returns jsonb language sql security definer set search_path=public as $$ select public.send_direct_message_v2(target_conversation_id,message_body,target_client_message_id,null); $$;

create or replace function public.edit_direct_message(target_message_id uuid,message_body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.direct_messages;
begin
  update public.direct_messages set body=message_body where id=target_message_id and author_id=auth.uid() and deleted_at is null returning * into result;
  if result.id is null then raise exception 'DM_EDIT_FORBIDDEN' using errcode='42501'; end if;
  return to_jsonb(result);
end;
$$;
create or replace function public.delete_direct_message(target_message_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.direct_messages;
begin
  update public.direct_messages set deleted_at=now() where id=target_message_id and author_id=auth.uid() and deleted_at is null returning * into result;
  if result.id is null then raise exception 'DM_DELETE_FORBIDDEN' using errcode='42501'; end if;
  return to_jsonb(result);
end;
$$;

create or replace function public.mark_direct_conversation_read(target_conversation_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare latest_id uuid;latest_created_at timestamptz;
begin
  if not public.is_direct_conversation_participant(target_conversation_id) then raise exception 'DM_READ_FORBIDDEN'; end if;
  select id,created_at into latest_id,latest_created_at from public.direct_messages where conversation_id=target_conversation_id order by created_at desc,id desc limit 1;
  update public.direct_conversation_participants set last_read_at=coalesce(latest_created_at,now()),last_read_message_id=latest_id where conversation_id=target_conversation_id and user_id=auth.uid();
  return found;
end;
$$;
create or replace function public.set_direct_conversation_preferences(target_conversation_id uuid,target_muted_until timestamptz,target_archived boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_direct_conversation_participant(target_conversation_id) then raise exception 'DM_PREFERENCES_FORBIDDEN' using errcode='42501'; end if;
  update public.direct_conversation_participants set muted_until=target_muted_until,archived_at=case when target_archived then now() else null end where conversation_id=target_conversation_id and user_id=auth.uid();
  return found;
end;
$$;

create or replace function public.list_direct_conversations(result_limit integer default 50)
returns table(id uuid,participant_user_id uuid,participant_name text,participant_username text,participant_status text,participant_status_text text,last_message_preview text,updated_at timestamptz,unread_count integer)
language sql stable security definer set search_path=public as $$
  select conversation.id,other.user_id,profile.display_name,profile.username,profile.status,profile.status_text,left(coalesce(last_message.body,''),160),greatest(conversation.updated_at,coalesce(conversation.last_message_at,conversation.updated_at)),
    (select count(*)::integer from public.direct_messages unread where unread.conversation_id=conversation.id and unread.author_id<>auth.uid() and unread.deleted_at is null and unread.created_at>coalesce(mine.last_read_at,'epoch'::timestamptz))
  from public.direct_conversation_participants mine
  join public.direct_conversations conversation on conversation.id=mine.conversation_id and conversation.type='direct' and conversation.superseded_by is null and conversation.participant_low_id is not null
  join public.direct_conversation_participants other on other.conversation_id=conversation.id and other.user_id<>auth.uid()
  join public.profiles profile on profile.id=other.user_id
  left join lateral(select message.body from public.direct_messages message where message.conversation_id=conversation.id and message.deleted_at is null order by message.created_at desc,id desc limit 1) last_message on true
  where mine.user_id=auth.uid() and mine.archived_at is null and public.is_direct_conversation_participant(conversation.id)
    and (select count(*) from public.direct_conversation_participants participant where participant.conversation_id=conversation.id)=2
  order by coalesce(conversation.last_message_at,conversation.updated_at) desc
  limit greatest(1,least(coalesce(result_limit,50),50));
$$;

drop policy if exists "direct_messages_delete_own" on public.direct_messages;
revoke delete on public.direct_messages from authenticated;
drop policy if exists "direct_reactions_insert_own" on public.direct_message_reactions;
drop policy if exists "direct_reactions_insert_own" on public.direct_message_reactions;
create policy "direct_reactions_insert_own" on public.direct_message_reactions for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.direct_messages message where message.id=message_id and message.deleted_at is null and public.can_send_direct_message(message.conversation_id)));
drop policy if exists "direct_attachments_select_participants" on public.direct_message_attachments;
drop policy if exists "direct_attachments_select_participants" on public.direct_message_attachments;
create policy "direct_attachments_select_participants" on public.direct_message_attachments for select to authenticated using(exists(select 1 from public.direct_messages message where message.id=message_id and message.deleted_at is null and public.is_direct_conversation_participant(message.conversation_id)));
drop policy if exists "direct_attachments_insert_participants" on public.direct_message_attachments;
drop policy if exists "direct_attachments_insert_participants" on public.direct_message_attachments;
create policy "direct_attachments_insert_participants" on public.direct_message_attachments for insert to authenticated with check(uploader_id=auth.uid() and exists(select 1 from public.direct_messages message where message.id=message_id and message.author_id=auth.uid() and message.deleted_at is null and public.can_send_direct_message(message.conversation_id)));
drop policy if exists "direct_attachments_delete_own" on public.direct_message_attachments;
create policy "direct_attachments_delete_own" on public.direct_message_attachments for delete to authenticated using(uploader_id=auth.uid() and exists(select 1 from public.direct_messages message where message.id=message_id and message.author_id=auth.uid() and public.is_direct_conversation_participant(message.conversation_id)));
grant delete on public.direct_message_attachments to authenticated;

revoke all on function public.send_direct_message_v2(uuid,text,text,uuid),public.edit_direct_message(uuid,text),public.delete_direct_message(uuid),public.set_direct_conversation_preferences(uuid,timestamptz,boolean) from public;
grant execute on function public.send_direct_message_v2(uuid,text,text,uuid),public.edit_direct_message(uuid,text),public.delete_direct_message(uuid),public.set_direct_conversation_preferences(uuid,timestamptz,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('direct-message-attachments','direct-message-attachments',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.dm_storage_path_uuid(object_name text,path_segment integer)
returns uuid language plpgsql immutable set search_path=public as $$
begin return split_part(object_name,'/',path_segment)::uuid;exception when invalid_text_representation then return null;end;
$$;
revoke all on function public.dm_storage_path_uuid(text,integer) from public;
grant execute on function public.dm_storage_path_uuid(text,integer) to authenticated;

drop policy if exists "dm attachments participant read" on storage.objects;
drop policy if exists "dm attachments author upload" on storage.objects;
drop policy if exists "dm attachments author update" on storage.objects;
drop policy if exists "dm attachments author delete" on storage.objects;
drop policy if exists "dm attachments participant read" on storage.objects;
create policy "dm attachments participant read" on storage.objects for select to authenticated using(
  bucket_id='direct-message-attachments'
  and exists(select 1 from public.direct_messages message where message.id=public.dm_storage_path_uuid(name,2) and message.conversation_id=public.dm_storage_path_uuid(name,1) and message.deleted_at is null and public.is_direct_conversation_participant(message.conversation_id))
);
drop policy if exists "dm attachments author upload" on storage.objects;
create policy "dm attachments author upload" on storage.objects for insert to authenticated with check(
  bucket_id='direct-message-attachments' and public.dm_storage_path_uuid(name,3)=auth.uid()
  and exists(select 1 from public.direct_messages message where message.id=public.dm_storage_path_uuid(name,2) and message.conversation_id=public.dm_storage_path_uuid(name,1) and message.author_id=auth.uid() and message.deleted_at is null and public.can_send_direct_message(message.conversation_id))
);
drop policy if exists "dm attachments author update" on storage.objects;
create policy "dm attachments author update" on storage.objects for update to authenticated using(bucket_id='direct-message-attachments' and public.dm_storage_path_uuid(name,3)=auth.uid() and public.is_direct_conversation_participant(public.dm_storage_path_uuid(name,1))) with check(bucket_id='direct-message-attachments' and public.dm_storage_path_uuid(name,3)=auth.uid());
drop policy if exists "dm attachments author delete" on storage.objects;
create policy "dm attachments author delete" on storage.objects for delete to authenticated using(bucket_id='direct-message-attachments' and public.dm_storage_path_uuid(name,3)=auth.uid() and public.is_direct_conversation_participant(public.dm_storage_path_uuid(name,1)));

comment on column public.direct_conversations.superseded_by is 'Legacy duplicate conversations remain readable for retention but cannot receive new activity.';
comment on column public.direct_conversation_participants.last_read_message_id is 'Precise participant-owned read cursor; last_read_at remains the unread query cursor.';
comment on function public.dm_storage_path_uuid(text,integer) is 'Safely parses the DM object path conversation/message/uploader UUID segments without throwing in RLS.';;
