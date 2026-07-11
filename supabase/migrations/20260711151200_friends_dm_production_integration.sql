begin;

create or replace function public.send_direct_message_v3(
  target_conversation_id uuid,
  message_body text,
  target_client_message_id text,
  target_reply_to_message_id uuid,
  target_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_body text := left(btrim(coalesce(message_body,'')),4000);
  normalized_client_id text := left(nullif(btrim(target_client_message_id),''),120);
  normalized_attachments jsonb := '[]'::jsonb;
  existing_attachments jsonb := '[]'::jsonb;
  attachment_count integer := 0;
  distinct_id_count integer := 0;
  distinct_path_count integer := 0;
  inserted_message boolean := false;
  result public.direct_messages;
begin
  if actor_id is null or normalized_body='' or normalized_client_id is null or not public.can_send_direct_message(target_conversation_id) then
    raise exception 'DM_SEND_FORBIDDEN' using errcode='42501';
  end if;
  if target_reply_to_message_id is not null and not exists(
    select 1 from public.direct_messages reply
    where reply.id=target_reply_to_message_id and reply.conversation_id=target_conversation_id and reply.deleted_at is null
  ) then raise exception 'DM_REPLY_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(target_attachments,'[]'::jsonb))<>'array' then
    raise exception 'DM_ATTACHMENTS_INVALID' using errcode='22023';
  end if;

  attachment_count:=jsonb_array_length(coalesce(target_attachments,'[]'::jsonb));
  if attachment_count>4 then raise exception 'DM_ATTACHMENTS_INVALID' using errcode='22023'; end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id',item.id,'storage_path',item.storage_path,'file_name',item.file_name,'mime_type',item.mime_type,
      'size_bytes',item.size_bytes,'width',item.width,'height',item.height
    ) order by item.id),'[]'::jsonb),
    count(distinct item.id),count(distinct item.storage_path)
  into normalized_attachments,distinct_id_count,distinct_path_count
  from jsonb_to_recordset(coalesce(target_attachments,'[]'::jsonb)) as item(
    id uuid,storage_path text,file_name text,mime_type text,size_bytes bigint,width integer,height integer
  );

  if attachment_count<>distinct_id_count or attachment_count<>distinct_path_count or exists(
    select 1
    from jsonb_to_recordset(normalized_attachments) as item(
      id uuid,storage_path text,file_name text,mime_type text,size_bytes bigint,width integer,height integer
    )
    where item.id is null
      or item.storage_path is null
      or split_part(item.storage_path,'/',1)<>target_conversation_id::text
      or split_part(item.storage_path,'/',2)<>item.id::text
      or split_part(item.storage_path,'/',3)<>actor_id::text
      or split_part(item.storage_path,'/',4)=''
      or split_part(item.storage_path,'/',5)<>''
      or char_length(btrim(coalesce(item.file_name,''))) not between 1 and 255
      or item.file_name ~ '[\\/]'
      or item.mime_type not in ('image/png','image/jpeg','image/webp','image/gif')
      or item.size_bytes not between 1 and 10485760
      or (item.width is not null and item.width<=0)
      or (item.height is not null and item.height<=0)
      or not exists(select 1 from storage.objects object where object.bucket_id='direct-message-attachments' and object.name=item.storage_path)
  ) then raise exception 'DM_ATTACHMENTS_INVALID' using errcode='22023'; end if;

  insert into public.direct_messages(conversation_id,author_id,body,client_message_id,reply_to_message_id)
  values(target_conversation_id,actor_id,normalized_body,normalized_client_id,target_reply_to_message_id)
  on conflict(author_id,client_message_id) where client_message_id is not null do nothing
  returning * into result;
  inserted_message:=result.id is not null;

  if not inserted_message then
    select * into result from public.direct_messages
    where author_id=actor_id and client_message_id=normalized_client_id for update;
    if result.id is null
      or result.conversation_id<>target_conversation_id
      or result.body is distinct from normalized_body
      or result.reply_to_message_id is distinct from target_reply_to_message_id then
      raise exception 'DM_IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',attachment.id,'storage_path',attachment.storage_path,'file_name',attachment.file_name,'mime_type',attachment.mime_type,
    'size_bytes',coalesce(attachment.size_bytes,attachment.file_size),'width',attachment.width,'height',attachment.height
  ) order by attachment.id),'[]'::jsonb)
  into existing_attachments
  from public.direct_message_attachments attachment where attachment.message_id=result.id;

  if not inserted_message and existing_attachments<>normalized_attachments then
    raise exception 'DM_IDEMPOTENCY_CONFLICT' using errcode='23505';
  end if;

  if inserted_message and attachment_count>0 then
    if exists(select 1 from public.direct_message_attachments attachment where attachment.id in(
      select item.id from jsonb_to_recordset(normalized_attachments) as item(id uuid,storage_path text,file_name text,mime_type text,size_bytes bigint,width integer,height integer)
    ) or attachment.storage_path in(
      select item.storage_path from jsonb_to_recordset(normalized_attachments) as item(id uuid,storage_path text,file_name text,mime_type text,size_bytes bigint,width integer,height integer)
    )) then raise exception 'DM_ATTACHMENTS_CONFLICT' using errcode='23505'; end if;

    insert into public.direct_message_attachments(id,message_id,url,storage_path,file_name,mime_type,file_size,size_bytes,width,height,uploader_id)
    select item.id,result.id,item.storage_path,item.storage_path,item.file_name,item.mime_type,item.size_bytes,item.size_bytes,item.width,item.height,actor_id
    from jsonb_to_recordset(normalized_attachments) as item(
      id uuid,storage_path text,file_name text,mime_type text,size_bytes bigint,width integer,height integer
    );
  end if;

  update public.direct_conversation_participants set archived_at=null where conversation_id=target_conversation_id;
  update public.direct_conversations set updated_at=result.created_at,last_message_at=result.created_at where id=target_conversation_id;
  return to_jsonb(result);
end;
$$;

create or replace function public.send_direct_message_v2(target_conversation_id uuid,message_body text,target_client_message_id text,target_reply_to_message_id uuid)
returns jsonb language sql security definer set search_path=public as $$
  select public.send_direct_message_v3(target_conversation_id,message_body,target_client_message_id,target_reply_to_message_id,'[]'::jsonb);
$$;

drop policy if exists "dm attachments participant read" on storage.objects;
drop policy if exists "dm attachments author upload" on storage.objects;
drop policy if exists "dm attachments author update" on storage.objects;
drop policy if exists "dm attachments author delete" on storage.objects;

create policy "dm attachments participant read" on storage.objects for select to authenticated using(
  bucket_id='direct-message-attachments' and (
    (public.dm_storage_path_uuid(name,3)=auth.uid() and public.can_send_direct_message(public.dm_storage_path_uuid(name,1)))
    or exists(
      select 1 from public.direct_message_attachments attachment
      join public.direct_messages message on message.id=attachment.message_id
      where attachment.storage_path=name
        and attachment.id=public.dm_storage_path_uuid(name,2)
        and message.conversation_id=public.dm_storage_path_uuid(name,1)
        and message.deleted_at is null
        and public.is_direct_conversation_participant(message.conversation_id)
    )
  )
);
create policy "dm attachments author upload" on storage.objects for insert to authenticated with check(
  bucket_id='direct-message-attachments'
  and public.dm_storage_path_uuid(name,2) is not null
  and public.dm_storage_path_uuid(name,3)=auth.uid()
  and public.can_send_direct_message(public.dm_storage_path_uuid(name,1))
);
create policy "dm attachments author update" on storage.objects for update to authenticated
using(bucket_id='direct-message-attachments' and public.dm_storage_path_uuid(name,3)=auth.uid() and public.is_direct_conversation_participant(public.dm_storage_path_uuid(name,1)))
with check(bucket_id='direct-message-attachments' and public.dm_storage_path_uuid(name,3)=auth.uid() and public.is_direct_conversation_participant(public.dm_storage_path_uuid(name,1)));
create policy "dm attachments author delete" on storage.objects for delete to authenticated using(
  bucket_id='direct-message-attachments' and public.dm_storage_path_uuid(name,3)=auth.uid() and public.is_direct_conversation_participant(public.dm_storage_path_uuid(name,1))
);

revoke all on function public.send_direct_message_v3(uuid,text,text,uuid,jsonb) from public,anon;
grant execute on function public.send_direct_message_v3(uuid,text,text,uuid,jsonb) to authenticated;

comment on function public.send_direct_message_v3(uuid,text,text,uuid,jsonb) is
  'Participant-only idempotent DM send boundary. Rejects payload conflicts and commits validated private attachment metadata with the message.';

commit;
