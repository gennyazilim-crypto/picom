begin;

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
  if not exists (
    select 1 from public.channels channel
    where channel.id = target_channel_id and channel.community_id = target_community_id
  ) then raise exception 'MESSAGE_CHANNEL_MISMATCH' using errcode = '22023'; end if;
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
    or array_position(coalesce(target_attachment_ids, '{}'::uuid[]), null) is not null
  then
    raise exception 'MESSAGE_ATTACHMENTS_INVALID' using errcode = '22023';
  end if;

  begin
    insert into public.messages(community_id, channel_id, author_id, body, client_message_id, reply_to_message_id)
    values (target_community_id, target_channel_id, actor_id, normalized_body, normalized_client_id, target_reply_to_message_id)
    returning * into message_record;
    inserted_message := true;
  exception
    when unique_violation then
      select message.*
      into message_record
      from public.messages message
      where message.author_id = actor_id
        and message.client_message_id = normalized_client_id
      for update;
  end;

  if message_record.id is null then raise exception 'MESSAGE_SEND_FAILED'; end if;
  if not inserted_message and (
    message_record.community_id <> target_community_id
    or message_record.channel_id <> target_channel_id
    or message_record.body <> normalized_body
    or message_record.reply_to_message_id is distinct from target_reply_to_message_id
  ) then
    raise exception 'MESSAGE_IDEMPOTENCY_CONFLICT' using errcode = '23505';
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
      and attachment.storage_path like format(
        'communities/%s/channels/%s/pending/%s/%%',
        target_community_id,
        target_channel_id,
        actor_id
      );
    if valid_attachment_count <> cardinality(normalized_attachment_ids) then
      raise exception 'MESSAGE_ATTACHMENTS_FORBIDDEN' using errcode = '42501';
    end if;

    update public.attachments attachment
    set message_id = message_record.id,
        status = 'attached'
    where attachment.id = any(normalized_attachment_ids);
  end if;

  return query
  select
    message.id,
    message.community_id,
    message.channel_id,
    message.author_id,
    message.body,
    message.client_message_id,
    message.sequence,
    message.created_at,
    message.edited_at,
    message.deleted_at,
    message.reply_to_message_id,
    message.webhook_id,
    message.webhook_name
  from public.messages message
  where message.id = message_record.id;
end;
$$;

revoke all on function public.send_text_message_idempotent(uuid, uuid, text, text, uuid, uuid[]) from public, anon;
grant execute on function public.send_text_message_idempotent(uuid, uuid, text, text, uuid, uuid[]) to authenticated;

comment on function public.send_text_message_idempotent(uuid, uuid, text, text, uuid, uuid[]) is
  'Authoritative Text send boundary with race-safe unique-violation reconciliation for client-message idempotency.';

commit;