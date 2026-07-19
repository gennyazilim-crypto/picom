-- Allow local Supabase storage URLs (http://127.0.0.1 / localhost) for community branding.
-- Production uploads remain HTTPS; this unblocks desktop/local branding previews and persistence.

alter table public.communities drop constraint if exists communities_icon_url_check;
alter table public.communities drop constraint if exists communities_banner_url_check;

alter table public.communities
  add constraint communities_icon_url_check check (
    icon_url is null
    or (
      char_length(icon_url) <= 2048
      and (
        icon_url ~* '^https://'
        or icon_url ~* '^http://127\.0\.0\.1(:[0-9]+)?/'
        or icon_url ~* '^http://localhost(:[0-9]+)?/'
        or icon_url ~* '^data:image/(png|jpeg|webp);base64,'
      )
    )
  );

alter table public.communities
  add constraint communities_banner_url_check check (
    banner_url is null
    or (
      char_length(banner_url) <= 2048
      and (
        banner_url ~* '^https://'
        or banner_url ~* '^http://127\.0\.0\.1(:[0-9]+)?/'
        or banner_url ~* '^http://localhost(:[0-9]+)?/'
        or banner_url ~* '^data:image/(png|jpeg|webp);base64,'
      )
    )
  );

create or replace function public.update_community_settings(
  target_community_id uuid,
  next_name text,
  next_description text,
  next_icon_url text,
  next_banner_url text,
  next_visibility text,
  next_public_read_enabled boolean,
  next_default_notification_level text,
  next_rules_enabled boolean,
  next_rules_version text,
  next_type_settings jsonb,
  next_rules jsonb
)
returns setof public.communities
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.communities%rowtype;
  updated public.communities%rowtype;
  clean_name text := nullif(regexp_replace(btrim(next_name), '\s+', ' ', 'g'), '');
  clean_description text := nullif(btrim(next_description), '');
  clean_icon text := nullif(btrim(next_icon_url), '');
  clean_banner text := nullif(btrim(next_banner_url), '');
  rule_count integer;
  brand_url_ok constant text := '^(https://|http://127\.0\.0\.1(:[0-9]+)?/|http://localhost(:[0-9]+)?/|data:image/(png|jpeg|webp);base64,)';
begin
  if auth.uid() is null or not public.effective_community_permission(target_community_id, 'manageCommunity') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  select * into target from public.communities where id = target_community_id and archived_at is null for update;
  if target.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = '22023'; end if;
  if clean_name is null or char_length(clean_name) > 80 then raise exception 'COMMUNITY_NAME_INVALID' using errcode = '22023'; end if;
  if clean_description is not null and char_length(clean_description) > 500 then raise exception 'COMMUNITY_DESCRIPTION_INVALID' using errcode = '22023'; end if;
  if clean_icon is not null and (char_length(clean_icon) > 2048 or clean_icon !~* brand_url_ok) then raise exception 'COMMUNITY_ICON_INVALID' using errcode = '22023'; end if;
  if clean_banner is not null and (char_length(clean_banner) > 2048 or clean_banner !~* brand_url_ok) then raise exception 'COMMUNITY_BANNER_INVALID' using errcode = '22023'; end if;
  if next_visibility not in ('public', 'private', 'secret') or next_default_notification_level not in ('all', 'mentions', 'none') then
    raise exception 'COMMUNITY_POLICY_INVALID' using errcode = '22023';
  end if;
  if next_rules_version !~ '^[a-zA-Z0-9._-]{1,32}$' or not public.valid_community_type_settings(target.kind, next_type_settings) then
    raise exception 'COMMUNITY_TYPE_SETTINGS_INVALID' using errcode = '22023';
  end if;
  if jsonb_typeof(next_rules) <> 'array' or jsonb_array_length(next_rules) > 10 then raise exception 'COMMUNITY_RULES_INVALID' using errcode = '22023'; end if;
  select count(*) into rule_count
  from jsonb_array_elements(next_rules) rule
  where char_length(btrim(rule->>'title')) between 1 and 120
    and char_length(btrim(rule->>'body')) between 1 and 2000
    and jsonb_typeof(rule->'required') = 'boolean';
  if rule_count <> jsonb_array_length(next_rules) or (coalesce(next_rules_enabled, false) and rule_count = 0) then
    raise exception 'COMMUNITY_RULES_INVALID' using errcode = '22023';
  end if;

  update public.communities set
    name = clean_name,
    description = clean_description,
    icon_url = clean_icon,
    banner_url = clean_banner,
    visibility = next_visibility,
    public_read_enabled = case when next_visibility in ('private', 'secret') then false else coalesce(next_public_read_enabled, false) end,
    default_notification_level = next_default_notification_level,
    rules_enabled = coalesce(next_rules_enabled, false),
    rules_version = next_rules_version,
    type_settings = next_type_settings,
    updated_at = now()
  where id = target_community_id
  returning * into updated;

  delete from public.community_rules where community_id = target_community_id;
  insert into public.community_rules(community_id, title, body, position, required, published)
  select target_community_id, btrim(rule->>'title'), btrim(rule->>'body'), ordinality - 1, (rule->>'required')::boolean, true
  from jsonb_array_elements(next_rules) with ordinality as entry(rule, ordinality);

  if target.kind = 'radio' then
    insert into public.radio_community_settings(community_id, schedule_timezone, listener_chat_enabled, default_host_role, schedule_visibility, listener_rules)
    values (
      target.id,
      next_type_settings->>'scheduleTimezone',
      (next_type_settings->>'listenerChatEnabled')::boolean,
      next_type_settings->>'defaultHostRole',
      next_type_settings->>'scheduleVisibility',
      next_type_settings->>'listenerRules'
    )
    on conflict (community_id) do update set
      schedule_timezone = excluded.schedule_timezone,
      listener_chat_enabled = excluded.listener_chat_enabled,
      default_host_role = excluded.default_host_role,
      schedule_visibility = excluded.schedule_visibility,
      listener_rules = excluded.listener_rules,
      updated_at = now();
  end if;

  if target.kind = 'podcast' then
    insert into public.podcast_community_settings(community_id, default_publisher_role, comments_enabled, explicit_content_default, comment_rules)
    values (
      target.id,
      next_type_settings->>'defaultPublisherRole',
      (next_type_settings->>'commentsEnabled')::boolean,
      (next_type_settings->>'explicitContentDefault')::boolean,
      next_type_settings->>'commentRules'
    )
    on conflict (community_id) do update set
      default_publisher_role = excluded.default_publisher_role,
      comments_enabled = excluded.comments_enabled,
      explicit_content_default = excluded.explicit_content_default,
      comment_rules = excluded.comment_rules,
      updated_at = now();
  end if;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values (updated.id, auth.uid(), 'community_update', 'community_settings', updated.id, public.redact_audit_reason('Community identity, rules, notification defaults, and kind settings updated'));

  return next updated;
end;
$$;
