alter table public.profiles add column if not exists dm_privacy text not null default 'everyone' check(dm_privacy in ('everyone','friends','no_one'));
create or replace function public.can_user_receive_dm(sender_id uuid,recipient_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select sender_id<>recipient_id and not public.users_are_blocked(sender_id,recipient_id) and exists(
    select 1 from public.profiles profile where profile.id=recipient_id and (
      profile.dm_privacy='everyone' or (
        profile.dm_privacy='friends' and exists(select 1 from public.friendships friendship where friendship.user_low_id=least(sender_id,recipient_id) and friendship.user_high_id=greatest(sender_id,recipient_id))
      )
    )
  );
$$;
create or replace function public.enforce_direct_conversation_two_members()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (select count(*) from public.direct_conversation_members where conversation_id=new.conversation_id)>=2 then raise exception 'GROUP_DM_NOT_SUPPORTED'; end if;
  return new;
end;
$$;
drop trigger if exists direct_conversation_two_member_limit on public.direct_conversation_members;
create trigger direct_conversation_two_member_limit before insert on public.direct_conversation_members for each row execute function public.enforce_direct_conversation_two_members();
create or replace function public.create_direct_conversation(other_user_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_conversation_id uuid;
begin
  if auth.uid() is null or other_user_id is null or not public.can_user_receive_dm(auth.uid(),other_user_id) then raise exception 'DM_PRIVACY_DENIED'; end if;
  select mine.conversation_id into new_conversation_id from public.direct_conversation_members mine join public.direct_conversation_members theirs on theirs.conversation_id=mine.conversation_id join public.direct_conversations conversation on conversation.id=mine.conversation_id and conversation.type='direct' where mine.user_id=auth.uid() and theirs.user_id=other_user_id and (select count(*) from public.direct_conversation_members members where members.conversation_id=mine.conversation_id)=2 limit 1;
  if new_conversation_id is not null then return new_conversation_id; end if;
  insert into public.direct_conversations(created_by) values(auth.uid()) returning id into new_conversation_id;
  insert into public.direct_conversation_members(conversation_id,user_id) values(new_conversation_id,auth.uid()),(new_conversation_id,other_user_id);
  return new_conversation_id;
end;
$$;
create or replace function public.send_direct_message(target_conversation_id uuid,message_body text,target_client_message_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare recipient_id uuid; result public.direct_messages;
begin
  message_body:=left(btrim(message_body),4000);
  if auth.uid() is null or message_body='' or not public.is_direct_conversation_member(target_conversation_id) then raise exception 'DM_SEND_FORBIDDEN'; end if;
  if (select count(*) from public.direct_conversation_members where conversation_id=target_conversation_id)<>2 then raise exception 'GROUP_DM_NOT_SUPPORTED'; end if;
  select user_id into recipient_id from public.direct_conversation_members where conversation_id=target_conversation_id and user_id<>auth.uid();
  if not public.can_user_receive_dm(auth.uid(),recipient_id) then raise exception 'DM_PRIVACY_DENIED'; end if;
  insert into public.direct_messages(conversation_id,author_id,body,client_message_id) values(target_conversation_id,auth.uid(),message_body,left(target_client_message_id,120))
  on conflict(author_id,client_message_id) where client_message_id is not null do update set body=public.direct_messages.body returning * into result;
  update public.direct_conversations set updated_at=result.created_at where id=target_conversation_id;
  return to_jsonb(result);
end;
$$;
create or replace function public.list_direct_conversations(result_limit integer default 50)
returns table(id uuid,participant_user_id uuid,participant_name text,participant_username text,participant_status text,participant_status_text text,last_message_preview text,updated_at timestamptz,unread_count integer)
language sql stable security definer set search_path=public as $$
  select conversation.id,other.user_id,profile.display_name,profile.username,profile.status,profile.status_text,left(coalesce(last_message.body,''),160),conversation.updated_at,
    (select count(*)::integer from public.direct_messages unread where unread.conversation_id=conversation.id and unread.author_id<>auth.uid() and unread.deleted_at is null and unread.created_at>coalesce(mine.last_read_at,'epoch'::timestamptz))
  from public.direct_conversation_members mine
  join public.direct_conversations conversation on conversation.id=mine.conversation_id and conversation.type='direct'
  join public.direct_conversation_members other on other.conversation_id=conversation.id and other.user_id<>auth.uid()
  join public.profiles profile on profile.id=other.user_id
  left join lateral(select message.body from public.direct_messages message where message.conversation_id=conversation.id and message.deleted_at is null order by message.created_at desc limit 1) last_message on true
  where mine.user_id=auth.uid() and public.is_direct_conversation_member(conversation.id)
    and (select count(*) from public.direct_conversation_members members where members.conversation_id=conversation.id)=2
  order by conversation.updated_at desc limit greatest(1,least(coalesce(result_limit,50),50));
$$;
create or replace function public.mark_direct_conversation_read(target_conversation_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_direct_conversation_member(target_conversation_id) then raise exception 'DM_READ_FORBIDDEN'; end if;
  update public.direct_conversation_members set last_read_at=now() where conversation_id=target_conversation_id and user_id=auth.uid(); return found;
end;
$$;
revoke insert on public.direct_messages from authenticated;
grant execute on function public.can_user_receive_dm(uuid,uuid),public.create_direct_conversation(uuid),public.send_direct_message(uuid,text,text),public.list_direct_conversations(integer),public.mark_direct_conversation_read(uuid) to authenticated;
comment on table public.direct_conversations is 'Exactly two participants; group direct messages are not supported.';
