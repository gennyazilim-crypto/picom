create or replace function public.can_send_message_to_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.channels channel
    join public.communities community on community.id = channel.community_id
    where channel.id = target_channel_id
      and community.kind = 'text'::public.community_kind
      and community.archived_at is null
      and channel.type = 'text'
      and public.is_community_member(channel.community_id)
      and public.can_view_channel(channel.id)
      and public.effective_community_permission(channel.community_id, 'sendMessages', 'channel', channel.id)
  );
$$;

create or replace function public.create_managed_text_channel(
  target_community_id uuid,
  target_category_id uuid default null,
  channel_name text default '',
  channel_type text default 'text',
  channel_topic text default null,
  channel_is_private boolean default false,
  channel_public_read_enabled boolean default true
)
returns setof public.channels
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_name text := lower(regexp_replace(btrim(channel_name), '[^a-zA-Z0-9]+', '-', 'g'));
  created_channel public.channels%rowtype;
begin
  normalized_name := btrim(normalized_name, '-');
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not public.community_has_kind(target_community_id, 'text') or not public.can_manage_channels_v2(target_community_id) then
    raise exception 'TEXT_CHANNEL_MANAGEMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if char_length(normalized_name) not between 1 and 80 then raise exception 'CHANNEL_NAME_INVALID' using errcode = '22023'; end if;
  if channel_type not in ('text', 'voice', 'forum', 'announcement') then raise exception 'CHANNEL_TYPE_INVALID' using errcode = '22023'; end if;
  if channel_topic is not null and char_length(channel_topic) > 300 then raise exception 'CHANNEL_TOPIC_INVALID' using errcode = '22023'; end if;
  if target_category_id is not null and not exists (
    select 1 from public.channel_categories category
    where category.id = target_category_id and category.community_id = target_community_id
  ) then raise exception 'CHANNEL_CATEGORY_INVALID' using errcode = '22023'; end if;

  insert into public.channels(community_id, category_id, name, type, topic, is_private, public_read_enabled, position)
  values (
    target_community_id,
    target_category_id,
    normalized_name,
    channel_type,
    nullif(btrim(channel_topic), ''),
    channel_is_private,
    case when channel_is_private then false else channel_public_read_enabled end,
    coalesce((select max(channel.position) + 1 from public.channels channel where channel.community_id = target_community_id and channel.category_id is not distinct from target_category_id), 0)
  )
  returning * into created_channel;
  return next created_channel;
end;
$$;

create or replace function public.send_text_message_idempotent(
  target_community_id uuid,
  target_channel_id uuid,
  message_body text,
  target_client_message_id text,
  target_reply_to_message_id uuid default null,
  target_attachment_ids uuid[] default '{}'::uuid[]
)
returns table(
  id uuid,
  community_id uuid,
  channel_id uuid,
  author_id uuid,
  body text,
  client_message_id text,
  sequence bigint,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  reply_to_message_id uuid,
  webhook_id uuid,
  webhook_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_body text := btrim(message_body);
  normalized_client_id text := btrim(target_client_message_id);
  normalized_attachment_ids uuid[];
  existing_attachment_ids uuid[];
  message_record public.messages%rowtype;
  valid_attachment_count integer := 0;
  inserted_message boolean := false;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if char_length(normalized_body) not between 1 and 4000 then raise exception 'MESSAGE_BODY_INVALID' using errcode = '22023'; end if;
  if char_length(normalized_client_id) not between 1 and 120 then raise exception 'CLIENT_MESSAGE_ID_INVALID' using errcode = '22023'; end if;
  if not public.can_send_message_to_channel(target_channel_id) then raise exception 'MESSAGE_SEND_FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.channels channel where channel.id = target_channel_id and channel.community_id = target_community_id) then
    raise exception 'MESSAGE_CHANNEL_MISMATCH' using errcode = '22023';
  end if;
  if target_reply_to_message_id is not null and not exists (
    select 1 from public.messages reply
    where reply.id = target_reply_to_message_id
      and reply.community_id = target_community_id
      and reply.channel_id = target_channel_id
  ) then raise exception 'MESSAGE_REPLY_INVALID' using errcode = '22023'; end if;

  select coalesce(array_agg(selected_id order by selected_id), '{}'::uuid[])
  into normalized_attachment_ids
  from (select distinct unnest(coalesce(target_attachment_ids, '{}'::uuid[])) as selected_id) selected;
  if cardinality(coalesce(target_attachment_ids, '{}'::uuid[])) > 4
    or cardinality(normalized_attachment_ids) <> cardinality(coalesce(target_attachment_ids, '{}'::uuid[]))
    or array_position(coalesce(target_attachment_ids, '{}'::uuid[]), null) is not null then
    raise exception 'MESSAGE_ATTACHMENTS_INVALID' using errcode = '22023';
  end if;

  insert into public.messages(community_id, channel_id, author_id, body, client_message_id, reply_to_message_id)
  values (target_community_id, target_channel_id, actor_id, normalized_body, normalized_client_id, target_reply_to_message_id)
  on conflict (author_id, client_message_id) where client_message_id is not null do nothing
  returning * into message_record;

  inserted_message := message_record.id is not null;

  if message_record.id is null then
    select * into message_record
    from public.messages message
    where message.author_id = actor_id and message.client_message_id = normalized_client_id
    for update;
    if message_record.id is null then raise exception 'MESSAGE_SEND_FAILED'; end if;
    if message_record.community_id <> target_community_id
      or message_record.channel_id <> target_channel_id
      or message_record.body <> normalized_body
      or message_record.reply_to_message_id is distinct from target_reply_to_message_id then
      raise exception 'MESSAGE_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
  end if;

  select coalesce(array_agg(attachment.id order by attachment.id), '{}'::uuid[])
  into existing_attachment_ids
  from public.attachments attachment
  where attachment.message_id = message_record.id;
  if not inserted_message and existing_attachment_ids <> normalized_attachment_ids then
    raise exception 'MESSAGE_IDEMPOTENCY_CONFLICT' using errcode = '23505';
  end if;

  if cardinality(normalized_attachment_ids) > 0 then
    select count(*) into valid_attachment_count
    from public.attachments attachment
    where attachment.id = any(normalized_attachment_ids)
      and attachment.uploader_id = actor_id
      and (attachment.message_id is null or attachment.message_id = message_record.id)
      and attachment.status in ('pending', 'attached')
      and coalesce(attachment.scan_status::text, 'pending') not in ('suspicious', 'failed')
      and attachment.storage_path like format('communities/%s/channels/%s/pending/%s/%%', target_community_id, target_channel_id, actor_id);
    if valid_attachment_count <> cardinality(normalized_attachment_ids) then raise exception 'MESSAGE_ATTACHMENTS_FORBIDDEN' using errcode = '42501'; end if;
    update public.attachments
    set message_id = message_record.id, status = 'attached'
    where id = any(normalized_attachment_ids);
  end if;

  return query select
    message.id, message.community_id, message.channel_id, message.author_id, message.body,
    message.client_message_id, message.sequence, message.created_at, message.edited_at,
    message.deleted_at, message.reply_to_message_id, message.webhook_id, message.webhook_name
  from public.messages message where message.id = message_record.id;
end;
$$;

do $$
declare policy_row record;
begin
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'channels' and cmd = 'INSERT'
  loop execute format('drop policy %I on public.channels', policy_row.policyname); end loop;
  for policy_row in select policyname from pg_policies where schemaname = 'public' and tablename = 'messages' and cmd = 'INSERT'
  loop execute format('drop policy %I on public.messages', policy_row.policyname); end loop;
end $$;

create policy channels_insert_text_manager on public.channels for insert to authenticated
with check (public.community_has_kind(community_id, 'text') and public.can_manage_channels_v2(community_id));

create policy messages_insert_author_visible_text_channel on public.messages for insert to authenticated
with check (author_id = auth.uid() and public.can_send_message_to_channel(channel_id));

revoke all on function public.create_managed_text_channel(uuid, uuid, text, text, text, boolean, boolean) from public, anon;
revoke all on function public.send_text_message_idempotent(uuid, uuid, text, text, uuid, uuid[]) from public, anon;
grant execute on function public.create_managed_text_channel(uuid, uuid, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.send_text_message_idempotent(uuid, uuid, text, text, uuid, uuid[]) to authenticated;

comment on function public.create_managed_text_channel(uuid, uuid, text, text, text, boolean, boolean) is
  'Creates a Text-community channel through the effective manageChannels permission boundary.';
comment on function public.send_text_message_idempotent(uuid, uuid, text, text, uuid, uuid[]) is
  'Authoritative Text-channel send boundary. Returns the prior success for an identical client message ID and atomically links validated pending attachments.';;
