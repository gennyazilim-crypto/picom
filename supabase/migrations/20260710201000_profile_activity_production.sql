-- Privacy-projected profile activity and media. The function is security
-- definer for aggregate relationship counts, but explicitly rechecks every
-- message/channel resource with the current auth context.

create or replace function public.get_profile_activity_v2(
  target_user_id uuid,
  result_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  projection record;
  target_profile public.profiles%rowtype;
  safe_limit integer := least(greatest(result_limit, 1), 50);
  profile_json jsonb;
  roles_json jsonb := '[]'::jsonb;
  stats_json jsonb := '{}'::jsonb;
  activities_json jsonb := '[]'::jsonb;
  media_json jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into projection
  from public.get_profile_privacy_projection(target_user_id);

  if projection.can_view_profile is not true then
    return jsonb_build_object(
      'can_view_profile', false,
      'profile', null,
      'roles', '[]'::jsonb,
      'stats', '{}'::jsonb,
      'activities', '[]'::jsonb,
      'media', '[]'::jsonb
    );
  end if;

  select * into target_profile from public.profiles where id = target_user_id;
  if target_profile.id is null then
    return jsonb_build_object('can_view_profile', false);
  end if;

  profile_json := jsonb_build_object(
    'id', target_profile.id,
    'display_name', target_profile.display_name,
    'username', target_profile.username,
    'avatar_url', target_profile.avatar_url,
    'status', target_profile.status,
    'status_text', target_profile.status_text,
    'bio', target_profile.bio,
    'created_at', target_profile.created_at,
    'location', projection.location,
    'timezone', projection.timezone
  );

  select coalesce(jsonb_agg(role_row.payload order by role_row.level desc, role_row.community_id), '[]'::jsonb)
  into roles_json
  from (
    select
      membership.community_id,
      role.level,
      jsonb_build_object(
        'community_id', membership.community_id,
        'role_name', role.name,
        'role_level', role.level
      ) as payload
    from public.community_members membership
    join public.roles role on role.id = membership.role_id and role.community_id = membership.community_id
    where membership.user_id = target_user_id
      and (target_user_id = auth.uid() or public.is_community_member(membership.community_id))
  ) role_row;

  stats_json := jsonb_build_object(
    'communities', (
      select count(*) from public.community_members membership
      where membership.user_id = target_user_id
        and (target_user_id = auth.uid() or public.is_community_member(membership.community_id))
    ),
    'posts', (
      select count(*) from public.messages message
      where message.author_id = target_user_id
        and message.deleted_at is null
        and public.can_view_message(message.id)
    ),
    'mentions', (
      select count(*) from public.message_mentions mention
      where mention.mentioned_user_id = target_user_id
        and public.can_view_message(mention.message_id)
    ),
    'reactions', (
      select count(*) from public.message_reactions reaction
      join public.messages message on message.id = reaction.message_id
      where message.author_id = target_user_id
        and message.deleted_at is null
        and public.can_view_message(message.id)
    ),
    'followers', (select count(*) from public.user_follows follow where follow.followed_id = target_user_id),
    'following', (select count(*) from public.user_follows follow where follow.follower_id = target_user_id),
    'roles', jsonb_array_length(roles_json)
  );

  if projection.show_activity then
    select coalesce(jsonb_agg(activity.payload order by activity.created_at desc, activity.id desc), '[]'::jsonb)
    into activities_json
    from (
      select combined.*
      from (
        select
          'message:' || message.id::text as id,
          message.created_at,
          jsonb_build_object(
            'id', 'message:' || message.id::text,
            'type', case
              when exists (
                select 1 from public.attachments attachment
                where attachment.message_id = message.id
                  and attachment.status = 'attached'
                  and attachment.scan_status in ('clean', 'skipped_development')
                  and attachment.public_url is not null
              ) then 'media_share'
              when exists (select 1 from public.message_mentions mention where mention.message_id = message.id) then 'mention'
              else 'message_post'
            end,
            'community_id', message.community_id,
            'channel_id', message.channel_id,
            'message_id', message.id,
            'title', case
              when exists (select 1 from public.attachments attachment where attachment.message_id = message.id and attachment.status = 'attached' and attachment.public_url is not null)
                then 'Shared media in #' || channel.name
              else 'Posted in #' || channel.name
            end,
            'preview', left(message.body, 240),
            'created_at', message.created_at
          ) as payload
        from public.messages message
        join public.channels channel on channel.id = message.channel_id
        where message.author_id = target_user_id
          and message.deleted_at is null
          and public.can_view_message(message.id)

        union all

        select
          'reaction:' || reaction.id::text,
          reaction.created_at,
          jsonb_build_object(
            'id', 'reaction:' || reaction.id::text,
            'type', 'reaction',
            'community_id', message.community_id,
            'channel_id', message.channel_id,
            'message_id', message.id,
            'title', 'Reacted in #' || channel.name,
            'preview', left('Reacted with ' || reaction.emoji || ' to: ' || message.body, 240),
            'created_at', reaction.created_at
          )
        from public.message_reactions reaction
        join public.messages message on message.id = reaction.message_id
        join public.channels channel on channel.id = message.channel_id
        where reaction.user_id = target_user_id
          and message.deleted_at is null
          and public.can_view_message(message.id)
      ) combined
      order by combined.created_at desc, combined.id desc
      limit safe_limit
    ) activity;
  end if;

  if projection.show_media then
    select coalesce(jsonb_agg(media.payload order by media.created_at desc, media.id desc), '[]'::jsonb)
    into media_json
    from (
      select
        attachment.id::text as id,
        message.created_at,
        jsonb_build_object(
          'id', attachment.id,
          'type', 'image',
          'url', attachment.public_url,
          'thumbnail_url', coalesce(attachment.thumbnail_url, attachment.public_url),
          'title', attachment.file_name,
          'created_at', message.created_at
        ) as payload
      from public.messages message
      join public.attachments attachment on attachment.message_id = message.id
      where message.author_id = target_user_id
        and message.deleted_at is null
        and public.can_view_message(message.id)
        and attachment.status = 'attached'
        and attachment.scan_status in ('clean', 'skipped_development')
        and attachment.public_url is not null
      order by message.created_at desc, attachment.id desc
      limit least(safe_limit, 12)
    ) media;
  end if;

  return jsonb_build_object(
    'can_view_profile', true,
    'profile', profile_json,
    'roles', roles_json,
    'stats', stats_json,
    'activities', activities_json,
    'media', media_json
  );
end;
$$;

revoke all on function public.get_profile_activity_v2(uuid, integer) from public, anon;
grant execute on function public.get_profile_activity_v2(uuid, integer) to authenticated;

comment on function public.get_profile_activity_v2(uuid, integer) is
  'Returns privacy-projected profile fields and only viewer-visible activity/media. No private-channel content, raw paths, credentials, IP data or unrelated member timelines.';
