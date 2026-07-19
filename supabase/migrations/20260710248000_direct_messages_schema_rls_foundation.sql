-- Canonical Direct Messages schema and participant-only RLS foundation.
-- This forward migration preserves existing DM rows while replacing the legacy
-- direct_conversation_members name with direct_conversation_participants.

begin;
do $migration$
begin
  if to_regclass('public.direct_conversation_participants') is null then
    if to_regclass('public.direct_conversation_members') is null then
      raise exception 'direct conversation membership table is missing';
    end if;
    alter table public.direct_conversation_members rename to direct_conversation_participants;
  end if;
end
$migration$;
alter table public.direct_conversations
  add column if not exists last_message_at timestamptz;
alter table public.direct_conversation_participants
  add column if not exists muted_until timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists blocked_at timestamptz;
alter table public.direct_messages
  add column if not exists reply_to_message_id uuid references public.direct_messages(id) on delete set null,
  alter column body drop not null;
alter table public.direct_message_attachments
  add column if not exists url text,
  add column if not exists file_size bigint,
  add column if not exists width integer,
  add column if not exists height integer,
  alter column uploader_id drop not null,
  alter column storage_path drop not null,
  alter column file_name drop not null,
  alter column mime_type drop not null,
  alter column size_bytes drop not null;
update public.direct_message_attachments
set url = coalesce(url, storage_path),
    file_size = coalesce(file_size, size_bytes)
where url is null or file_size is null;
alter table public.direct_message_attachments
  alter column url set not null,
  add constraint direct_message_attachments_url_length_check check (char_length(url) between 1 and 2048),
  add constraint direct_message_attachments_url_scheme_check check (url !~* '^(javascript|data|file):'),
  add constraint direct_message_attachments_file_size_check check (file_size is null or (file_size > 0 and file_size <= 10485760)),
  add constraint direct_message_attachments_width_check check (width is null or width > 0),
  add constraint direct_message_attachments_height_check check (height is null or height > 0);
update public.direct_conversations conversation
set last_message_at = (
  select max(message.created_at)
  from public.direct_messages message
  where message.conversation_id = conversation.id
)
where conversation.last_message_at is null;
create index if not exists idx_direct_conversation_participants_user_id
  on public.direct_conversation_participants(user_id);
create index if not exists idx_direct_conversation_participants_conversation_id
  on public.direct_conversation_participants(conversation_id);
create index if not exists idx_direct_messages_conversation_created_at
  on public.direct_messages(conversation_id, created_at);
create index if not exists idx_direct_messages_author_id
  on public.direct_messages(author_id);
create index if not exists idx_direct_messages_client_message_id
  on public.direct_messages(client_message_id);
create index if not exists idx_direct_message_reactions_message_id
  on public.direct_message_reactions(message_id);
create or replace function public.is_direct_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.direct_conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = auth.uid()
  );
$$;
create or replace function public.is_direct_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_direct_conversation_participant(target_conversation_id);
$$;
create or replace function public.can_send_direct_message(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_direct_conversation_participant(target_conversation_id)
    and exists (
      select 1
      from public.direct_conversation_participants own
      where own.conversation_id = target_conversation_id
        and own.user_id = auth.uid()
        and own.blocked_at is null
    )
    and not exists (
      select 1
      from public.direct_conversation_participants participant
      where participant.conversation_id = target_conversation_id
        and participant.blocked_at is not null
    )
    and not exists (
      select 1
      from public.direct_conversation_participants other
      where other.conversation_id = target_conversation_id
        and other.user_id <> auth.uid()
        and public.users_are_blocked(auth.uid(), other.user_id)
    );
$$;
revoke all on function public.is_direct_conversation_participant(uuid) from public;
revoke all on function public.is_direct_conversation_member(uuid) from public;
revoke all on function public.can_send_direct_message(uuid) from public;
grant execute on function public.is_direct_conversation_participant(uuid) to authenticated;
grant execute on function public.is_direct_conversation_member(uuid) to authenticated;
grant execute on function public.can_send_direct_message(uuid) to authenticated;
create or replace function public.enforce_direct_conversation_two_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.direct_conversation_participants where conversation_id = new.conversation_id) >= 2 then
    raise exception 'GROUP_DM_NOT_SUPPORTED';
  end if;
  return new;
end;
$$;
drop trigger if exists direct_conversation_two_member_limit on public.direct_conversation_participants;
create trigger direct_conversation_two_member_limit
before insert on public.direct_conversation_participants
for each row execute function public.enforce_direct_conversation_two_members();
create or replace function public.validate_direct_message_reply_target()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reply_to_message_id is not null and not exists (
    select 1 from public.direct_messages parent
    where parent.id = new.reply_to_message_id
      and parent.conversation_id = new.conversation_id
  ) then
    raise exception 'DM_REPLY_TARGET_INVALID';
  end if;
  return new;
end;
$$;
drop trigger if exists direct_message_reply_target_guard on public.direct_messages;
create trigger direct_message_reply_target_guard
before insert or update of conversation_id, reply_to_message_id on public.direct_messages
for each row execute function public.validate_direct_message_reply_target();
create or replace function public.touch_direct_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.direct_conversations
  set updated_at = greatest(updated_at, new.created_at),
      last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
  where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists direct_message_touch_conversation on public.direct_messages;
create trigger direct_message_touch_conversation
after insert on public.direct_messages
for each row execute function public.touch_direct_conversation_last_message();
create or replace function public.create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_conversation_id uuid;
begin
  if auth.uid() is null or other_user_id is null or not public.can_user_receive_dm(auth.uid(), other_user_id) then
    raise exception 'DM_PRIVACY_DENIED';
  end if;

  select mine.conversation_id into new_conversation_id
  from public.direct_conversation_participants mine
  join public.direct_conversation_participants theirs on theirs.conversation_id = mine.conversation_id
  join public.direct_conversations conversation on conversation.id = mine.conversation_id and conversation.type = 'direct'
  where mine.user_id = auth.uid()
    and theirs.user_id = other_user_id
    and (select count(*) from public.direct_conversation_participants participant where participant.conversation_id = mine.conversation_id) = 2
  limit 1;

  if new_conversation_id is not null then return new_conversation_id; end if;

  insert into public.direct_conversations(created_by) values (auth.uid()) returning id into new_conversation_id;
  insert into public.direct_conversation_participants(conversation_id, user_id)
  values (new_conversation_id, auth.uid()), (new_conversation_id, other_user_id);
  return new_conversation_id;
end;
$$;
create or replace function public.send_direct_message(target_conversation_id uuid, message_body text, target_client_message_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.direct_messages;
begin
  if message_body is null then raise exception 'DM_MESSAGE_REQUIRED'; end if;
  message_body := left(btrim(message_body), 4000);
  if auth.uid() is null or message_body = '' or not public.can_send_direct_message(target_conversation_id) then
    raise exception 'DM_SEND_FORBIDDEN';
  end if;
  if (select count(*) from public.direct_conversation_participants where conversation_id = target_conversation_id) <> 2 then
    raise exception 'GROUP_DM_NOT_SUPPORTED';
  end if;

  insert into public.direct_messages(conversation_id, author_id, body, client_message_id)
  values (target_conversation_id, auth.uid(), message_body, left(target_client_message_id, 120))
  on conflict(author_id, client_message_id) where client_message_id is not null
  do update set body = public.direct_messages.body
  returning * into result;
  return to_jsonb(result);
end;
$$;
create or replace function public.list_direct_conversations(result_limit integer default 50)
returns table(id uuid, participant_user_id uuid, participant_name text, participant_username text, participant_status text, participant_status_text text, last_message_preview text, updated_at timestamptz, unread_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select conversation.id,
    other.user_id,
    profile.display_name,
    profile.username,
    profile.status,
    profile.status_text,
    left(coalesce(last_message.body, ''), 160),
    greatest(conversation.updated_at, coalesce(conversation.last_message_at, conversation.updated_at)),
    (select count(*)::integer from public.direct_messages unread
      where unread.conversation_id = conversation.id
        and unread.author_id <> auth.uid()
        and unread.deleted_at is null
        and unread.created_at > coalesce(mine.last_read_at, 'epoch'::timestamptz))
  from public.direct_conversation_participants mine
  join public.direct_conversations conversation on conversation.id = mine.conversation_id and conversation.type = 'direct'
  join public.direct_conversation_participants other on other.conversation_id = conversation.id and other.user_id <> auth.uid()
  join public.profiles profile on profile.id = other.user_id
  left join lateral (
    select message.body from public.direct_messages message
    where message.conversation_id = conversation.id and message.deleted_at is null
    order by message.created_at desc limit 1
  ) last_message on true
  where mine.user_id = auth.uid()
    and public.is_direct_conversation_participant(conversation.id)
    and (select count(*) from public.direct_conversation_participants participant where participant.conversation_id = conversation.id) = 2
  order by coalesce(conversation.last_message_at, conversation.updated_at) desc
  limit greatest(1, least(coalesce(result_limit, 50), 50));
$$;
create or replace function public.mark_direct_conversation_read(target_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_direct_conversation_participant(target_conversation_id) then raise exception 'DM_READ_FORBIDDEN'; end if;
  update public.direct_conversation_participants
  set last_read_at = now()
  where conversation_id = target_conversation_id and user_id = auth.uid();
  return found;
end;
$$;
revoke all on function public.create_direct_conversation(uuid) from public;
revoke all on function public.send_direct_message(uuid, text, text) from public;
revoke all on function public.list_direct_conversations(integer) from public;
revoke all on function public.mark_direct_conversation_read(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text, text) to authenticated;
grant execute on function public.list_direct_conversations(integer) to authenticated;
grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;
alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_participants enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_message_attachments enable row level security;
alter table public.direct_message_reactions enable row level security;
drop policy if exists "direct_conversations_select_members" on public.direct_conversations;
create policy "direct_conversations_select_participants" on public.direct_conversations
for select to authenticated using (public.is_direct_conversation_participant(id));
drop policy if exists "direct_members_select_members" on public.direct_conversation_participants;
drop policy if exists "direct_participants_select_participants" on public.direct_conversation_participants;
create policy "direct_participants_select_participants" on public.direct_conversation_participants
for select to authenticated using (public.is_direct_conversation_participant(conversation_id));
drop policy if exists "direct_messages_select_members" on public.direct_messages;
drop policy if exists "direct_messages_insert_member_author" on public.direct_messages;
drop policy if exists "direct_messages_update_author" on public.direct_messages;
drop policy if exists "direct_messages_delete_author" on public.direct_messages;
create policy "direct_messages_select_participants" on public.direct_messages
for select to authenticated using (public.is_direct_conversation_participant(conversation_id));
create policy "direct_messages_insert_participant_author" on public.direct_messages
for insert to authenticated with check (author_id = auth.uid() and public.can_send_direct_message(conversation_id));
create policy "direct_messages_update_own" on public.direct_messages
for update to authenticated
using (author_id = auth.uid() and public.is_direct_conversation_participant(conversation_id))
with check (author_id = auth.uid() and public.is_direct_conversation_participant(conversation_id));
create policy "direct_messages_delete_own" on public.direct_messages
for delete to authenticated using (author_id = auth.uid() and public.is_direct_conversation_participant(conversation_id));
drop policy if exists "direct_reactions_select_members" on public.direct_message_reactions;
drop policy if exists "direct_reactions_insert_self_member" on public.direct_message_reactions;
drop policy if exists "direct_reactions_delete_self" on public.direct_message_reactions;
create policy "direct_reactions_select_participants" on public.direct_message_reactions
for select to authenticated using (exists (
  select 1 from public.direct_messages message
  where message.id = message_id and public.is_direct_conversation_participant(message.conversation_id)
));
create policy "direct_reactions_insert_own" on public.direct_message_reactions
for insert to authenticated with check (user_id = auth.uid() and exists (
  select 1 from public.direct_messages message
  where message.id = message_id and public.can_send_direct_message(message.conversation_id)
));
create policy "direct_reactions_delete_own" on public.direct_message_reactions
for delete to authenticated using (user_id = auth.uid() and exists (
  select 1 from public.direct_messages message
  where message.id = message_id and public.is_direct_conversation_participant(message.conversation_id)
));
drop policy if exists "direct_attachments_select_members" on public.direct_message_attachments;
drop policy if exists "direct_attachments_insert_uploader_member" on public.direct_message_attachments;
drop policy if exists "direct_attachments_insert_uploader_author" on public.direct_message_attachments;
create policy "direct_attachments_select_participants" on public.direct_message_attachments
for select to authenticated using (exists (
  select 1 from public.direct_messages message
  where message.id = message_id and public.is_direct_conversation_participant(message.conversation_id)
));
create policy "direct_attachments_insert_participants" on public.direct_message_attachments
for insert to authenticated with check (
  (uploader_id is null or uploader_id = auth.uid())
  and exists (
    select 1 from public.direct_messages message
    where message.id = message_id and public.can_send_direct_message(message.conversation_id)
  )
);
revoke all on public.direct_conversations, public.direct_conversation_participants, public.direct_messages,
  public.direct_message_attachments, public.direct_message_reactions from anon;
revoke all on public.direct_conversations, public.direct_conversation_participants, public.direct_messages,
  public.direct_message_attachments, public.direct_message_reactions from authenticated;
grant select on public.direct_conversations, public.direct_conversation_participants, public.direct_messages,
  public.direct_message_attachments, public.direct_message_reactions to authenticated;
grant insert (conversation_id, author_id, body, reply_to_message_id, client_message_id) on public.direct_messages to authenticated;
grant update (body, reply_to_message_id, updated_at, edited_at, deleted_at) on public.direct_messages to authenticated;
grant delete on public.direct_messages to authenticated;
grant insert (message_id, user_id, emoji) on public.direct_message_reactions to authenticated;
grant delete on public.direct_message_reactions to authenticated;
grant insert (message_id, url, file_name, mime_type, file_size, width, height, uploader_id, storage_path, size_bytes)
  on public.direct_message_attachments to authenticated;
comment on table public.direct_conversations is 'Private direct-message metadata. SELECT is participant-only.';
comment on table public.direct_conversation_participants is 'Canonical participant state. Muting, archiving, or blocking never grants conversation access.';
comment on table public.direct_messages is 'Private direct-message content excluded from public search and Mention Feed.';
comment on column public.direct_message_attachments.url is 'Opaque storage locator or application URL; never persist signed tokens or local filesystem paths.';
commit;
