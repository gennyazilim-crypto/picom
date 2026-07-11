begin;

create unique index if not exists direct_message_attachments_message_url_idx
  on public.direct_message_attachments(message_id,url);

create or replace function public.mark_direct_conversation_read_to(target_conversation_id uuid,target_message_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare target_created_at timestamptz;
begin
  if not public.is_direct_conversation_participant(target_conversation_id) then raise exception 'DM_READ_FORBIDDEN' using errcode='42501'; end if;
  select created_at into target_created_at from public.direct_messages where id=target_message_id and conversation_id=target_conversation_id;
  if target_created_at is null then raise exception 'DM_READ_TARGET_INVALID' using errcode='22023'; end if;
  update public.direct_conversation_participants participant
  set last_read_at=case when participant.last_read_at is null or target_created_at>participant.last_read_at then target_created_at else participant.last_read_at end,
      last_read_message_id=case when participant.last_read_at is null or target_created_at>=participant.last_read_at then target_message_id else participant.last_read_message_id end
  where participant.conversation_id=target_conversation_id and participant.user_id=auth.uid();
  return found;
end;
$$;

create or replace function public.set_direct_conversation_muted(target_conversation_id uuid,target_muted_until timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_direct_conversation_participant(target_conversation_id) then raise exception 'DM_PREFERENCES_FORBIDDEN' using errcode='42501'; end if;
  update public.direct_conversation_participants set muted_until=target_muted_until where conversation_id=target_conversation_id and user_id=auth.uid();
  return found;
end;
$$;

create or replace function public.set_direct_conversation_archived(target_conversation_id uuid,target_archived boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_direct_conversation_participant(target_conversation_id) then raise exception 'DM_PREFERENCES_FORBIDDEN' using errcode='42501'; end if;
  update public.direct_conversation_participants set archived_at=case when target_archived then now() else null end where conversation_id=target_conversation_id and user_id=auth.uid();
  return found;
end;
$$;

create or replace function public.list_direct_shared_media(target_conversation_id uuid,before_created_at timestamptz default null,before_attachment_id uuid default null,result_limit integer default 24)
returns table(id uuid,message_id uuid,url text,file_name text,mime_type text,file_size bigint,width integer,height integer,created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select attachment.id,attachment.message_id,attachment.url,attachment.file_name,attachment.mime_type,coalesce(attachment.size_bytes,attachment.file_size),attachment.width,attachment.height,attachment.created_at
  from public.direct_message_attachments attachment
  join public.direct_messages message on message.id=attachment.message_id
  where message.conversation_id=target_conversation_id and message.deleted_at is null
    and public.is_direct_conversation_participant(target_conversation_id)
    and (before_created_at is null or (attachment.created_at,attachment.id)<(before_created_at,before_attachment_id))
  order by attachment.created_at desc,attachment.id desc
  limit greatest(1,least(coalesce(result_limit,24),101));
$$;

alter table public.direct_conversations replica identity full;
alter table public.direct_conversation_participants replica identity full;
alter table public.direct_message_reactions replica identity full;
alter table public.direct_message_attachments replica identity full;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_conversations') then alter publication supabase_realtime add table public.direct_conversations; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_conversation_participants') then alter publication supabase_realtime add table public.direct_conversation_participants; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_message_attachments') then alter publication supabase_realtime add table public.direct_message_attachments; end if;
  end if;
end $$;

revoke all on function public.mark_direct_conversation_read_to(uuid,uuid),public.set_direct_conversation_muted(uuid,timestamptz),public.set_direct_conversation_archived(uuid,boolean),public.list_direct_shared_media(uuid,timestamptz,uuid,integer) from public;
grant execute on function public.mark_direct_conversation_read_to(uuid,uuid),public.set_direct_conversation_muted(uuid,timestamptz),public.set_direct_conversation_archived(uuid,boolean),public.list_direct_shared_media(uuid,timestamptz,uuid,integer) to authenticated;

comment on function public.mark_direct_conversation_read_to(uuid,uuid) is 'Advances the authenticated participant read cursor monotonically to a message in the same conversation.';
comment on function public.list_direct_shared_media(uuid,timestamptz,uuid,integer) is 'Returns a stable participant-only attachment page without exposing DM content to outsiders.';

commit;
