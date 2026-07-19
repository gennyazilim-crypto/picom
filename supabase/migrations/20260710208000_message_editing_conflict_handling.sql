-- Compare-and-set message edit/delete mutations. Direct client UPDATE is revoked
-- so all desktop clients participate in the same conflict contract.

create or replace function public.can_delete_message_for_current_user(target_message_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.messages message
    where message.id=target_message_id and public.can_view_message(message.id) and (
      message.author_id=auth.uid() or public.is_community_owner(message.community_id) or exists(
        select 1 from public.community_members member join public.roles role on role.id=member.role_id
        where member.community_id=message.community_id and member.user_id=auth.uid()
          and (role.level>=60 or coalesce((role.permissions->>'deleteAnyMessage')::boolean,false) or coalesce((role.permissions->>'moderateMessages')::boolean,false))
      )
    )
  );
$$;
create or replace function public.edit_message_with_version(target_message_id uuid,next_body text,expected_edited_at timestamptz default null)
returns table(id uuid,body text,edited_at timestamptz,deleted_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_message public.messages%rowtype; normalized_body text:=btrim(next_body); next_edited_at timestamptz:=clock_timestamp();
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if normalized_body='' or char_length(normalized_body)>4000 then raise exception 'MESSAGE_EDIT_INVALID' using errcode='22023'; end if;
  select * into current_message from public.messages message where message.id=target_message_id for update;
  if current_message.id is null or current_message.author_id<>auth.uid() or not public.can_view_message(current_message.id) then raise exception 'MESSAGE_EDIT_FORBIDDEN' using errcode='42501'; end if;
  if current_message.deleted_at is not null then raise exception 'MESSAGE_DELETED_CONFLICT' using errcode='40001'; end if;
  if current_message.edited_at is distinct from expected_edited_at then raise exception 'MESSAGE_VERSION_CONFLICT' using errcode='40001'; end if;
  return query update public.messages as message set body=normalized_body,edited_at=next_edited_at where message.id=target_message_id returning message.id,message.body,message.edited_at,message.deleted_at;
end;
$$;
create or replace function public.delete_message_with_version(target_message_id uuid,expected_edited_at timestamptz default null)
returns table(id uuid,deleted_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_message public.messages%rowtype; next_deleted_at timestamptz:=clock_timestamp();
begin
  if auth.uid() is null or not public.can_delete_message_for_current_user(target_message_id) then raise exception 'MESSAGE_DELETE_FORBIDDEN' using errcode='42501'; end if;
  select * into current_message from public.messages message where message.id=target_message_id for update;
  if current_message.id is null then raise exception 'MESSAGE_DELETE_FORBIDDEN' using errcode='42501'; end if;
  if current_message.deleted_at is not null then return query select current_message.id,current_message.deleted_at; return; end if;
  if current_message.edited_at is distinct from expected_edited_at then raise exception 'MESSAGE_VERSION_CONFLICT' using errcode='40001'; end if;
  return query update public.messages as message set deleted_at=next_deleted_at where message.id=target_message_id returning message.id,message.deleted_at;
end;
$$;
revoke all on function public.can_delete_message_for_current_user(uuid),public.edit_message_with_version(uuid,text,timestamptz),public.delete_message_with_version(uuid,timestamptz) from public,anon;
grant execute on function public.edit_message_with_version(uuid,text,timestamptz),public.delete_message_with_version(uuid,timestamptz) to authenticated;
revoke update on public.messages from authenticated;
comment on function public.edit_message_with_version(uuid,text,timestamptz) is 'Author-only compare-and-set edit. Stale or deleted versions fail without overwriting newer state.';
comment on function public.delete_message_with_version(uuid,timestamptz) is 'Idempotent authorized soft delete with version conflict protection; delete remains terminal.';
