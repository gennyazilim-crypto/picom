-- Realtime Authorization exposes the joining JWT through request.jwt.claims.
-- Pass its immutable subject explicitly into a SECURITY DEFINER membership
-- check instead of depending on nested auth.uid() evaluation.
create or replace function public.can_access_picom_realtime_topic_for_subject(
  target_subject text,
  target_topic text,
  target_extension text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, realtime, pg_temp
as $$
declare
  target_user_id uuid;
  target_community_id uuid;
  target_channel_id uuid;
  uuid_pattern constant text := '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
begin
  if target_subject is null or target_topic is null or target_extension is null then
    return false;
  end if;

  target_user_id := target_subject::uuid;

  if target_extension = 'presence'
    and target_topic ~ ('^presence:community:' || uuid_pattern || '$') then
    target_community_id := split_part(target_topic, ':', 3)::uuid;
    return exists (
      select 1
      from public.community_members membership
      where membership.user_id = target_user_id
        and membership.community_id = target_community_id
    );
  end if;

  if target_extension in ('broadcast', 'presence')
    and target_topic ~ ('^(typing|room):community:' || uuid_pattern || ':channel:' || uuid_pattern || '$') then
    target_community_id := split_part(target_topic, ':', 3)::uuid;
    target_channel_id := split_part(target_topic, ':', 5)::uuid;
    return exists (
      select 1
      from public.channels channel
      join public.community_members membership
        on membership.community_id = channel.community_id
       and membership.user_id = target_user_id
      where channel.id = target_channel_id
        and channel.community_id = target_community_id
        and (
          not channel.is_private
          or public.is_community_owner(target_community_id)
          or exists (
            select 1
            from public.roles role
            where role.id = membership.role_id
              and role.level >= 80
          )
        )
    );
  end if;

  return false;
exception
  when invalid_text_representation then
    return false;
end;
$$;
revoke all on function public.can_access_picom_realtime_topic_for_subject(text, text, text) from public, anon;
grant execute on function public.can_access_picom_realtime_topic_for_subject(text, text, text) to authenticated;
drop policy if exists "picom members receive private realtime topics" on realtime.messages;
create policy "picom members receive private realtime topics"
on realtime.messages
for select
to authenticated
using (
  public.can_access_picom_realtime_topic_for_subject(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    (select realtime.topic()),
    extension::text
  )
);
drop policy if exists "picom members send private realtime topics" on realtime.messages;
create policy "picom members send private realtime topics"
on realtime.messages
for insert
to authenticated
with check (
  public.can_access_picom_realtime_topic_for_subject(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    (select realtime.topic()),
    extension::text
  )
);
comment on function public.can_access_picom_realtime_topic_for_subject(text, text, text) is
  'Authorizes private Realtime topics from the immutable JWT subject plus community membership and channel visibility.';
