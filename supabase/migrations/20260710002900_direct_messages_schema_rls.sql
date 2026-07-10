-- Direct Messages schema and RLS foundation.
-- Conversation membership is the only read boundary; clients cannot add themselves to arbitrary conversations.

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct' check (type = 'direct'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.direct_conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (conversation_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null default '' check (char_length(body) <= 4000),
  client_message_id text check (client_message_id is null or char_length(client_message_id) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists uq_direct_messages_author_client_id
  on public.direct_messages(author_id, client_message_id)
  where client_message_id is not null;
create index if not exists idx_direct_members_user_updated
  on public.direct_conversation_members(user_id, conversation_id);
create index if not exists idx_direct_messages_conversation_created
  on public.direct_messages(conversation_id, created_at desc, id desc);

create table if not exists public.direct_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 64),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create table if not exists public.direct_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/gif')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create or replace function public.is_direct_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.direct_conversation_members member
    where member.conversation_id = target_conversation_id
      and member.user_id = auth.uid()
  );
$$;

grant execute on function public.is_direct_conversation_member(uuid) to authenticated;

create or replace function public.create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_conversation_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if other_user_id is null or other_user_id = auth.uid() then raise exception 'invalid participant'; end if;
  if not exists (select 1 from public.profiles where id = other_user_id) then raise exception 'profile not found'; end if;

  select mine.conversation_id into new_conversation_id
  from public.direct_conversation_members mine
  join public.direct_conversation_members theirs on theirs.conversation_id = mine.conversation_id
  join public.direct_conversations conversation on conversation.id = mine.conversation_id and conversation.type = 'direct'
  where mine.user_id = auth.uid() and theirs.user_id = other_user_id
    and (select count(*) from public.direct_conversation_members all_members where all_members.conversation_id = mine.conversation_id) = 2
  limit 1;

  if new_conversation_id is not null then return new_conversation_id; end if;

  insert into public.direct_conversations(created_by) values (auth.uid()) returning id into new_conversation_id;
  insert into public.direct_conversation_members(conversation_id, user_id)
  values (new_conversation_id, auth.uid()), (new_conversation_id, other_user_id);
  return new_conversation_id;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

grant select on public.direct_conversations, public.direct_conversation_members, public.direct_messages,
  public.direct_message_reactions, public.direct_message_attachments to authenticated;
grant insert, update on public.direct_messages to authenticated;
grant insert, delete on public.direct_message_reactions to authenticated;
grant insert on public.direct_message_attachments to authenticated;

alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_members enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_message_reactions enable row level security;
alter table public.direct_message_attachments enable row level security;

create policy "direct_conversations_select_members" on public.direct_conversations
for select to authenticated using (public.is_direct_conversation_member(id));

create policy "direct_members_select_members" on public.direct_conversation_members
for select to authenticated using (public.is_direct_conversation_member(conversation_id));

create policy "direct_messages_select_members" on public.direct_messages
for select to authenticated using (public.is_direct_conversation_member(conversation_id));
create policy "direct_messages_insert_member_author" on public.direct_messages
for insert to authenticated with check (author_id = auth.uid() and public.is_direct_conversation_member(conversation_id));
create policy "direct_messages_update_author" on public.direct_messages
for update to authenticated
using (author_id = auth.uid() and public.is_direct_conversation_member(conversation_id))
with check (author_id = auth.uid() and public.is_direct_conversation_member(conversation_id));

create policy "direct_reactions_select_members" on public.direct_message_reactions
for select to authenticated using (
  exists (select 1 from public.direct_messages message where message.id = message_id and public.is_direct_conversation_member(message.conversation_id))
);
create policy "direct_reactions_insert_self_member" on public.direct_message_reactions
for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.direct_messages message where message.id = message_id and public.is_direct_conversation_member(message.conversation_id)
  )
);
create policy "direct_reactions_delete_self" on public.direct_message_reactions
for delete to authenticated using (user_id = auth.uid());

create policy "direct_attachments_select_members" on public.direct_message_attachments
for select to authenticated using (
  exists (select 1 from public.direct_messages message where message.id = message_id and public.is_direct_conversation_member(message.conversation_id))
);
create policy "direct_attachments_insert_uploader_member" on public.direct_message_attachments
for insert to authenticated with check (
  uploader_id = auth.uid() and exists (
    select 1 from public.direct_messages message where message.id = message_id and public.is_direct_conversation_member(message.conversation_id)
  )
);
