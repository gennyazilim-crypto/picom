create table if not exists public.thread_read_states (
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(thread_id,user_id)
);
alter table public.thread_read_states enable row level security;
grant select on public.thread_read_states to authenticated;
create policy "thread_read_states_self_select" on public.thread_read_states for select to authenticated using(user_id=auth.uid() and public.can_view_thread(thread_id));

create or replace function public.can_reply_thread(target_thread_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.threads thread where thread.id=target_thread_id and thread.archived_at is null and public.can_view_thread(thread.id) and public.can_send_message_to_channel(thread.channel_id));
$$;

create or replace function public.open_or_create_thread(target_community_id uuid,target_channel_id uuid,target_parent_message_id uuid,thread_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.threads;
begin
  if auth.uid() is null or not public.can_send_message_to_channel(target_channel_id) then raise exception 'THREAD_CREATE_FORBIDDEN'; end if;
  if not exists(select 1 from public.messages parent where parent.id=target_parent_message_id and parent.community_id=target_community_id and parent.channel_id=target_channel_id and parent.thread_id is null and parent.deleted_at is null) then raise exception 'THREAD_PARENT_INVALID'; end if;
  thread_name:=left(coalesce(nullif(btrim(thread_name),''),'Message thread'),100);
  insert into public.threads(community_id,channel_id,parent_message_id,name,created_by) values(target_community_id,target_channel_id,target_parent_message_id,thread_name,auth.uid())
  on conflict(parent_message_id) do update set name=public.threads.name returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.send_thread_message(target_thread_id uuid,message_body text,target_client_message_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target_thread public.threads; result public.messages;
begin
  message_body:=left(btrim(message_body),4000);
  if message_body='' or auth.uid() is null or not public.can_reply_thread(target_thread_id) then raise exception 'THREAD_REPLY_FORBIDDEN'; end if;
  select * into target_thread from public.threads where id=target_thread_id;
  insert into public.messages(community_id,channel_id,thread_id,author_id,body,client_message_id)
  values(target_thread.community_id,target_thread.channel_id,target_thread.id,auth.uid(),message_body,target_client_message_id)
  on conflict(author_id,client_message_id) where client_message_id is not null do update set body=public.messages.body returning * into result;
  return jsonb_build_object('id',result.id,'thread_id',result.thread_id,'author_id',result.author_id,'body',result.body,'created_at',result.created_at);
end;
$$;

create or replace function public.get_thread_summary(target_thread_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'replyCount',count(message.id),
    'unreadCount',count(message.id) filter(where message.created_at>coalesce(read_state.last_read_at,'epoch'::timestamptz) and message.author_id<>auth.uid()),
    'lastReplyAt',max(message.created_at)
  )
  from public.threads thread
  left join public.messages message on message.thread_id=thread.id and message.deleted_at is null
  left join public.thread_read_states read_state on read_state.thread_id=thread.id and read_state.user_id=auth.uid()
  where thread.id=target_thread_id and public.can_view_thread(thread.id)
  group by read_state.last_read_at;
$$;

create or replace function public.mark_thread_read(target_thread_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.can_view_thread(target_thread_id) then raise exception 'THREAD_READ_FORBIDDEN'; end if;
  insert into public.thread_read_states(thread_id,user_id,last_read_at) values(target_thread_id,auth.uid(),now())
  on conflict(thread_id,user_id) do update set last_read_at=excluded.last_read_at;
  return true;
end;
$$;

drop policy if exists "messages_insert_author_visible_text_channel" on public.messages;
create policy "messages_insert_author_visible_text_channel" on public.messages for insert to authenticated
with check(author_id=auth.uid() and public.can_send_message_to_channel(channel_id) and (thread_id is null or exists(select 1 from public.threads thread where thread.id=thread_id and thread.channel_id=channel_id and thread.community_id=community_id and thread.archived_at is null and public.can_view_thread(thread.id))));

revoke insert on public.threads from authenticated;
grant execute on function public.can_reply_thread(uuid),public.open_or_create_thread(uuid,uuid,uuid,text),public.send_thread_message(uuid,text,uuid),public.get_thread_summary(uuid),public.mark_thread_read(uuid) to authenticated;
alter publication supabase_realtime add table public.threads;
