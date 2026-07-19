begin;
create or replace function public.can_manage_channels_v2(target_community_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.communities c
    left join public.community_members cm on cm.community_id = c.id and cm.user_id = auth.uid()
    left join public.roles r on r.id = cm.role_id
    where c.id = target_community_id and (c.owner_id = auth.uid() or lower(coalesce(r.name, '')) in ('owner', 'admin'))
  );
$$;
create or replace function public.update_managed_channel(target_channel_id uuid, next_name text, next_type text, next_topic text, next_category_id uuid, next_is_private boolean, next_public_read_enabled boolean)
returns setof public.channels language plpgsql security definer set search_path = public as $$
declare current_channel public.channels%rowtype; normalized_name text;
begin
  select * into current_channel from public.channels where id = target_channel_id for update;
  if not found then raise exception 'CHANNEL_NOT_FOUND'; end if;
  if not public.can_manage_channels_v2(current_channel.community_id) then raise exception 'PERMISSION_DENIED'; end if;
  normalized_name := trim(both '-' from regexp_replace(lower(trim(next_name)), '[^a-z0-9_-]+', '-', 'g'));
  if normalized_name = '' or next_type not in ('text', 'voice', 'forum', 'announcement') then raise exception 'VALIDATION_ERROR'; end if;
  if next_category_id is not null and not exists (select 1 from public.channel_categories where id = next_category_id and community_id = current_channel.community_id) then raise exception 'CATEGORY_NOT_FOUND'; end if;
  update public.channels set name = normalized_name, type = next_type, topic = next_topic, category_id = next_category_id, is_private = next_is_private, public_read_enabled = case when next_is_private then false else next_public_read_enabled end, updated_at = now() where id = target_channel_id returning * into current_channel;
  return next current_channel;
end;
$$;
create or replace function public.delete_managed_channel(target_channel_id uuid, confirmation_name text)
returns table(deleted_channel_id uuid, fallback_channel_id uuid) language plpgsql security definer set search_path = public as $$
declare current_channel public.channels%rowtype; fallback_id uuid;
begin
  select * into current_channel from public.channels where id = target_channel_id for update;
  if not found then raise exception 'CHANNEL_NOT_FOUND'; end if;
  if not public.can_manage_channels_v2(current_channel.community_id) then raise exception 'PERMISSION_DENIED'; end if;
  if lower(trim(confirmation_name)) <> lower(current_channel.name) then raise exception 'CONFIRMATION_MISMATCH'; end if;
  select id into fallback_id from public.channels where community_id = current_channel.community_id and id <> target_channel_id order by position asc, created_at asc limit 1;
  if fallback_id is null then raise exception 'LAST_CHANNEL_REQUIRED'; end if;
  delete from public.channels where id = target_channel_id;
  return query select target_channel_id, fallback_id;
end;
$$;
revoke all on function public.can_manage_channels_v2(uuid) from public;
revoke all on function public.update_managed_channel(uuid, text, text, text, uuid, boolean, boolean) from public;
revoke all on function public.delete_managed_channel(uuid, text) from public;
grant execute on function public.can_manage_channels_v2(uuid) to authenticated;
grant execute on function public.update_managed_channel(uuid, text, text, text, uuid, boolean, boolean) to authenticated;
grant execute on function public.delete_managed_channel(uuid, text) to authenticated;
commit;
