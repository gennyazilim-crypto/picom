-- Task 539: bind durable meeting chat to Picom's canonical messaging tables.
-- This migration stores context/link metadata only; message bodies, replies,
-- attachments, reactions, read state and moderation stay in existing tables.

create table if not exists public.meeting_chat_contexts (
  room_id uuid primary key references public.meeting_rooms(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete restrict,
  thread_id uuid references public.threads(id) on delete set null,
  context_kind text not null check (context_kind in ('linked_channel','dedicated_thread','meeting_source')),
  preserve_after_meeting boolean not null default true,
  guest_access_expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((context_kind='linked_channel' and thread_id is null) or (context_kind in ('dedicated_thread','meeting_source') and thread_id is not null))
);

create table if not exists public.meeting_chat_message_links (
  message_id uuid primary key references public.messages(id) on delete cascade,
  room_id uuid not null references public.meeting_chat_contexts(room_id) on delete cascade,
  session_id uuid references public.meeting_sessions(id) on delete set null,
  linked_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_chat_context_channel on public.meeting_chat_contexts(channel_id,room_id);
create index if not exists idx_meeting_chat_context_thread on public.meeting_chat_contexts(thread_id) where thread_id is not null;
create index if not exists idx_meeting_chat_links_room_session on public.meeting_chat_message_links(room_id,session_id,created_at);

alter table public.meeting_chat_contexts enable row level security;
alter table public.meeting_chat_message_links enable row level security;
revoke all on table public.meeting_chat_contexts,public.meeting_chat_message_links from public,anon,authenticated;
grant select on table public.meeting_chat_contexts,public.meeting_chat_message_links to authenticated;

create or replace function public.can_access_meeting_chat(target_room_id uuid,target_session_id uuid default null,require_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare chat_record public.meeting_chat_contexts%rowtype; room_record public.meeting_rooms%rowtype; session_record public.meeting_sessions%rowtype; participant_record public.meeting_session_participants%rowtype; thread_archived_at timestamptz;
begin
  if auth.uid() is null then return false; end if;
  select * into chat_record from public.meeting_chat_contexts where room_id=target_room_id;
  select * into room_record from public.meeting_rooms where id=target_room_id and archived_at is null;
  if chat_record.room_id is null or room_record.id is null then return false; end if;
  if chat_record.thread_id is not null then select archived_at into thread_archived_at from public.threads where id=chat_record.thread_id; end if;

  if public.is_community_member(chat_record.community_id) then
    return public.can_view_channel(chat_record.channel_id)
      and (chat_record.preserve_after_meeting or room_record.status not in ('ended','cancelled'))
      and (not require_write or (thread_archived_at is null and public.can_send_message_to_channel(chat_record.channel_id)));
  end if;

  if target_session_id is null or (chat_record.guest_access_expires_at is not null and chat_record.guest_access_expires_at<=now()) then return false; end if;
  select * into session_record from public.meeting_sessions where id=target_session_id and room_id=target_room_id and status in ('preparing','live','reconnecting') and ended_at is null;
  if session_record.id is null or room_record.status not in ('open','live','locked') then return false; end if;
  select * into participant_record from public.meeting_session_participants where session_id=target_session_id and user_id=auth.uid() and state in ('joining','connected','reconnecting');
  if participant_record.id is null then return false; end if;
  if require_write and (thread_archived_at is not null or participant_record.role='viewer' or participant_record.capabilities->>'canSendChat'='false') then return false; end if;
  return true;
end;
$$;

revoke all on function public.can_access_meeting_chat(uuid,uuid,boolean) from public,anon;
grant execute on function public.can_access_meeting_chat(uuid,uuid,boolean) to authenticated;

drop policy if exists meeting_chat_context_visible_select on public.meeting_chat_contexts;
create policy meeting_chat_context_visible_select on public.meeting_chat_contexts for select to authenticated using(public.can_access_meeting_chat(room_id,null,false) or exists(select 1 from public.meeting_sessions session where session.room_id=room_id and public.can_access_meeting_chat(room_id,session.id,false)));
drop policy if exists meeting_chat_links_visible_select on public.meeting_chat_message_links;
create policy meeting_chat_links_visible_select on public.meeting_chat_message_links for select to authenticated using(public.can_access_meeting_chat(room_id,session_id,false));

create or replace function public.configure_meeting_chat_context(
  target_room_id uuid,
  target_context_kind text,
  target_channel_id uuid default null,
  target_thread_id uuid default null,
  target_preserve_after_meeting boolean default true,
  target_guest_access_expires_at timestamptz default null
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare actor_id uuid:=auth.uid(); room_record public.meeting_rooms%rowtype; channel_record public.channels%rowtype; existing_context public.meeting_chat_contexts%rowtype; selected_thread_id uuid; root_message_id uuid;
begin
  if actor_id is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  select * into room_record from public.meeting_rooms where id=target_room_id and archived_at is null for update;
  if room_record.id is null then raise exception 'MEETING_ROOM_NOT_FOUND' using errcode='22023'; end if;
  if not public.can_manage_meeting_waiting(target_room_id) then raise exception 'MEETING_CHAT_MANAGE_FORBIDDEN' using errcode='42501'; end if;
  if target_context_kind not in ('linked_channel','dedicated_thread','meeting_source') then raise exception 'MEETING_CHAT_CONTEXT_INVALID' using errcode='22023'; end if;
  select * into channel_record from public.channels where id=coalesce(target_channel_id,room_record.linked_chat_channel_id,room_record.channel_id) and community_id=room_record.community_id and type='text';
  if channel_record.id is null then raise exception 'MEETING_CHAT_CHANNEL_INVALID' using errcode='22023'; end if;
  select * into existing_context from public.meeting_chat_contexts where room_id=target_room_id for update;

  if target_context_kind='linked_channel' then selected_thread_id:=null;
  elsif target_context_kind='dedicated_thread' then
    select id into selected_thread_id from public.threads where id=target_thread_id and community_id=room_record.community_id and channel_id=channel_record.id;
    if selected_thread_id is null then raise exception 'MEETING_CHAT_THREAD_INVALID' using errcode='22023'; end if;
  else
    if existing_context.context_kind='meeting_source' and existing_context.thread_id is not null then selected_thread_id:=existing_context.thread_id;
    else
      insert into public.messages(community_id,channel_id,author_id,body,client_message_id)
      values(room_record.community_id,channel_record.id,actor_id,'Meeting chat: '||room_record.title,'meeting-chat-root:'||target_room_id::text)
      on conflict(author_id,client_message_id) where client_message_id is not null do nothing returning id into root_message_id;
      if root_message_id is null then select id into root_message_id from public.messages where author_id=actor_id and client_message_id='meeting-chat-root:'||target_room_id::text; end if;
      insert into public.threads(community_id,channel_id,parent_message_id,name,created_by)
      values(room_record.community_id,channel_record.id,root_message_id,left(room_record.title||' meeting chat',100),actor_id)
      on conflict(parent_message_id) do update set name=excluded.name returning id into selected_thread_id;
    end if;
  end if;

  insert into public.meeting_chat_contexts(room_id,community_id,channel_id,thread_id,context_kind,preserve_after_meeting,guest_access_expires_at,created_by,updated_at)
  values(target_room_id,room_record.community_id,channel_record.id,selected_thread_id,target_context_kind,target_preserve_after_meeting,target_guest_access_expires_at,actor_id,now())
  on conflict(room_id) do update set community_id=excluded.community_id,channel_id=excluded.channel_id,thread_id=excluded.thread_id,context_kind=excluded.context_kind,preserve_after_meeting=excluded.preserve_after_meeting,guest_access_expires_at=excluded.guest_access_expires_at,updated_at=now();
  update public.meeting_rooms set linked_chat_channel_id=channel_record.id,updated_at=now() where id=target_room_id;
  if root_message_id is not null then insert into public.meeting_chat_message_links(message_id,room_id,linked_by_user_id) values(root_message_id,target_room_id,actor_id) on conflict(message_id) do nothing; end if;
  return jsonb_build_object('roomId',target_room_id,'communityId',room_record.community_id,'channelId',channel_record.id,'threadId',selected_thread_id,'contextKind',target_context_kind,'preserveAfterMeeting',target_preserve_after_meeting,'guestAccessExpiresAt',target_guest_access_expires_at);
end;
$$;

revoke all on function public.configure_meeting_chat_context(uuid,text,uuid,uuid,boolean,timestamptz) from public,anon;
grant execute on function public.configure_meeting_chat_context(uuid,text,uuid,uuid,boolean,timestamptz) to authenticated;

create or replace function public.get_meeting_chat_context(target_room_id uuid,target_session_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare chat_record public.meeting_chat_contexts%rowtype; room_title text;
begin
  if not public.can_access_meeting_chat(target_room_id,target_session_id,false) then raise exception 'MEETING_CHAT_ACCESS_FORBIDDEN' using errcode='42501'; end if;
  select * into chat_record from public.meeting_chat_contexts where room_id=target_room_id;
  select title into room_title from public.meeting_rooms where id=target_room_id;
  return jsonb_build_object('roomId',chat_record.room_id,'sessionId',target_session_id,'communityId',chat_record.community_id,'channelId',chat_record.channel_id,'threadId',chat_record.thread_id,'contextKind',chat_record.context_kind,'title',room_title,'preserveAfterMeeting',chat_record.preserve_after_meeting,'guestAccessExpiresAt',chat_record.guest_access_expires_at,'canRead',true,'canWrite',public.can_access_meeting_chat(target_room_id,target_session_id,true),'isGuest',not public.is_community_member(chat_record.community_id));
end;
$$;

revoke all on function public.get_meeting_chat_context(uuid,uuid) from public,anon;
grant execute on function public.get_meeting_chat_context(uuid,uuid) to authenticated;

create or replace function public.send_meeting_chat_message(
  target_room_id uuid,target_session_id uuid,message_body text,target_client_message_id text,
  target_reply_to_message_id uuid default null,target_attachment_ids uuid[] default '{}'::uuid[]
) returns table(id uuid,community_id uuid,channel_id uuid,author_id uuid,body text,client_message_id text,sequence bigint,created_at timestamptz,edited_at timestamptz,deleted_at timestamptz,reply_to_message_id uuid,thread_id uuid,webhook_id uuid,webhook_name text)
language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare actor_id uuid:=auth.uid(); chat_record public.meeting_chat_contexts%rowtype; normalized_body text:=btrim(message_body); normalized_client_id text:=btrim(target_client_message_id); normalized_attachment_ids uuid[]; existing_attachment_ids uuid[]; message_record public.messages%rowtype; valid_attachment_count integer:=0; inserted_message boolean:=false;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.can_access_meeting_chat(target_room_id,target_session_id,true) then raise exception 'MEETING_CHAT_SEND_FORBIDDEN' using errcode='42501'; end if;
  select * into chat_record from public.meeting_chat_contexts where room_id=target_room_id;
  if char_length(normalized_body) not between 1 and 4000 then raise exception 'MESSAGE_BODY_INVALID' using errcode='22023'; end if;
  if char_length(normalized_client_id) not between 1 and 120 then raise exception 'CLIENT_MESSAGE_ID_INVALID' using errcode='22023'; end if;
  if target_session_id is not null and not exists(select 1 from public.meeting_sessions where id=target_session_id and room_id=target_room_id) then raise exception 'MEETING_CHAT_SESSION_INVALID' using errcode='22023'; end if;
  if target_reply_to_message_id is not null and not exists(select 1 from public.messages reply where reply.id=target_reply_to_message_id and reply.community_id=chat_record.community_id and reply.channel_id=chat_record.channel_id and reply.thread_id is not distinct from chat_record.thread_id and public.can_view_message(reply.id)) then raise exception 'MESSAGE_REPLY_INVALID' using errcode='22023'; end if;

  select coalesce(array_agg(selected_id order by selected_id),'{}'::uuid[]) into normalized_attachment_ids from(select distinct unnest(coalesce(target_attachment_ids,'{}'::uuid[])) selected_id) selected;
  if cardinality(coalesce(target_attachment_ids,'{}'::uuid[]))>4 or cardinality(normalized_attachment_ids)<>cardinality(coalesce(target_attachment_ids,'{}'::uuid[])) or array_position(coalesce(target_attachment_ids,'{}'::uuid[]),null) is not null then raise exception 'MESSAGE_ATTACHMENTS_INVALID' using errcode='22023'; end if;

  insert into public.messages(community_id,channel_id,author_id,body,client_message_id,reply_to_message_id,thread_id)
  values(chat_record.community_id,chat_record.channel_id,actor_id,normalized_body,normalized_client_id,target_reply_to_message_id,chat_record.thread_id)
  on conflict(author_id,client_message_id) where client_message_id is not null do nothing returning * into message_record;
  inserted_message:=message_record.id is not null;
  if message_record.id is null then
    select * into message_record from public.messages message where message.author_id=actor_id and message.client_message_id=normalized_client_id for update;
    if message_record.id is null or message_record.community_id<>chat_record.community_id or message_record.channel_id<>chat_record.channel_id or message_record.thread_id is distinct from chat_record.thread_id or message_record.body<>normalized_body or message_record.reply_to_message_id is distinct from target_reply_to_message_id then raise exception 'MESSAGE_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
    if not exists(select 1 from public.meeting_chat_message_links link where link.message_id=message_record.id and link.room_id=target_room_id) then raise exception 'MESSAGE_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
  end if;

  select coalesce(array_agg(attachment.id order by attachment.id),'{}'::uuid[]) into existing_attachment_ids from public.attachments attachment where attachment.message_id=message_record.id;
  if not inserted_message and existing_attachment_ids<>normalized_attachment_ids then raise exception 'MESSAGE_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
  if cardinality(normalized_attachment_ids)>0 then
    select count(*) into valid_attachment_count from public.attachments attachment where attachment.id=any(normalized_attachment_ids) and attachment.uploader_id=actor_id and (attachment.message_id is null or attachment.message_id=message_record.id) and attachment.status in ('pending','attached') and coalesce(attachment.scan_status::text,'pending') not in ('suspicious','failed') and attachment.storage_path like format('communities/%s/channels/%s/pending/%s/%%',chat_record.community_id,chat_record.channel_id,actor_id);
    if valid_attachment_count<>cardinality(normalized_attachment_ids) then raise exception 'MESSAGE_ATTACHMENTS_FORBIDDEN' using errcode='42501'; end if;
    update public.attachments set message_id=message_record.id,status='attached' where id=any(normalized_attachment_ids);
  end if;
  insert into public.meeting_chat_message_links(message_id,room_id,session_id,linked_by_user_id) values(message_record.id,target_room_id,target_session_id,actor_id) on conflict(message_id) do nothing;
  return query select message.id,message.community_id,message.channel_id,message.author_id,message.body,message.client_message_id,message.sequence,message.created_at,message.edited_at,message.deleted_at,message.reply_to_message_id,message.thread_id,message.webhook_id,message.webhook_name from public.messages message where message.id=message_record.id;
end;
$$;

revoke all on function public.send_meeting_chat_message(uuid,uuid,text,text,uuid,uuid[]) from public,anon;
grant execute on function public.send_meeting_chat_message(uuid,uuid,text,text,uuid,uuid[]) to authenticated;

create or replace function public.can_view_message(target_message_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.messages message where message.id=target_message_id and (
      public.can_view_channel(message.channel_id)
      or exists(
        select 1 from public.meeting_chat_contexts context
        left join public.meeting_chat_message_links link on link.room_id=context.room_id and link.message_id=message.id
        where ((context.thread_id is not null and context.thread_id=message.thread_id) or link.message_id is not null)
          and public.can_access_meeting_chat(context.room_id,link.session_id,false)
      )
    )
  )
$$;

revoke all on function public.can_view_message(uuid) from public,anon;
grant execute on function public.can_view_message(uuid) to authenticated;

drop policy if exists meeting_chat_messages_visible_select on public.messages;
create policy meeting_chat_messages_visible_select on public.messages for select to authenticated using(public.can_view_message(id));

create or replace function public.can_view_thread(target_thread_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.threads thread join public.channels channel on channel.id=thread.channel_id join public.communities community on community.id=thread.community_id where thread.id=target_thread_id and ((community.visibility='public' and community.public_read_enabled and not channel.is_private and channel.public_read_enabled) or exists(select 1 from public.community_members member where member.community_id=community.id and member.user_id=auth.uid())))
    or exists(select 1 from public.meeting_chat_contexts context join public.meeting_sessions session on session.room_id=context.room_id where context.thread_id=target_thread_id and public.can_access_meeting_chat(context.room_id,session.id,false));
$$;

revoke all on function public.can_view_thread(uuid) from public,anon;
grant execute on function public.can_view_thread(uuid) to authenticated;

create or replace function public.mark_meeting_chat_read(target_room_id uuid,target_session_id uuid,target_last_read_message_id uuid default null)
returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare chat_record public.meeting_chat_contexts%rowtype;
begin
  if auth.uid() is null or not public.can_access_meeting_chat(target_room_id,target_session_id,false) then raise exception 'MEETING_CHAT_READ_FORBIDDEN' using errcode='42501'; end if;
  select * into chat_record from public.meeting_chat_contexts where room_id=target_room_id;
  if target_last_read_message_id is not null and not public.can_view_message(target_last_read_message_id) then raise exception 'MEETING_CHAT_READ_MESSAGE_INVALID' using errcode='22023'; end if;
  insert into public.read_states(channel_id,user_id,last_read_message_id,updated_at) values(chat_record.channel_id,auth.uid(),target_last_read_message_id,now()) on conflict(channel_id,user_id) do update set last_read_message_id=excluded.last_read_message_id,updated_at=now();
  if chat_record.thread_id is not null then insert into public.thread_read_states(thread_id,user_id,last_read_at) values(chat_record.thread_id,auth.uid(),now()) on conflict(thread_id,user_id) do update set last_read_at=now(); end if;
  return true;
end;
$$;

revoke all on function public.mark_meeting_chat_read(uuid,uuid,uuid) from public,anon;
grant execute on function public.mark_meeting_chat_read(uuid,uuid,uuid) to authenticated;
