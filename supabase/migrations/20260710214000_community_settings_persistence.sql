-- Task 282: validated owner/admin community settings persistence.

create or replace function public.update_community_settings(
  target_community_id uuid,
  next_name text default null,
  next_description text default null,
  next_icon_url text default null,
  next_visibility text default null,
  next_public_read_enabled boolean default null
)
returns setof public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.communities%rowtype;
  cleaned_name text := nullif(regexp_replace(btrim(next_name), '\s+', ' ', 'g'), '');
  cleaned_description text := nullif(btrim(next_description), '');
  cleaned_icon_url text := nullif(btrim(next_icon_url), '');
begin
  if auth.uid() is null or not (public.is_community_owner(target_community_id) or public.has_community_role_level(target_community_id, 80)) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if cleaned_name is null or char_length(cleaned_name) > 80 then raise exception 'COMMUNITY_NAME_INVALID' using errcode = '22023'; end if;
  if cleaned_description is not null and char_length(cleaned_description) > 500 then raise exception 'COMMUNITY_DESCRIPTION_INVALID' using errcode = '22023'; end if;
  if cleaned_icon_url is not null and (char_length(cleaned_icon_url) > 2048 or cleaned_icon_url !~* '^https://') then raise exception 'COMMUNITY_ICON_INVALID' using errcode = '22023'; end if;
  if next_visibility not in ('public', 'private') then raise exception 'COMMUNITY_VISIBILITY_INVALID' using errcode = '22023'; end if;

  update public.communities set
    name = cleaned_name,
    description = cleaned_description,
    icon_url = cleaned_icon_url,
    visibility = next_visibility,
    public_read_enabled = case when next_visibility = 'private' then false else coalesce(next_public_read_enabled, false) end,
    updated_at = now()
  where id = target_community_id returning * into updated;
  if updated.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = '22023'; end if;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(updated.id, auth.uid(), 'community_update', 'community', updated.id, public.redact_audit_reason('Community settings updated'));
  return next updated;
end;
$$;

revoke all on function public.update_community_settings(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_community_settings(uuid, text, text, text, text, boolean) to authenticated;

comment on function public.update_community_settings(uuid, text, text, text, text, boolean) is
  'Owner/admin-only validated settings update. Frontend visibility is UX; this function is the authorization boundary and emits redacted audit metadata.';
