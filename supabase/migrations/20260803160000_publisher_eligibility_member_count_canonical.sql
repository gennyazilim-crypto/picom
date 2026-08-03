-- Case 04 / community founder eligibility: align member counting with real staging schema.
-- community_members has no status column; ownership is communities.owner_id (not role_id).
-- Valid members = DISTINCT community_members.user_id that pass active-profile + media-member gates.

begin;

create or replace function public.publisher_profile_is_active_account(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    left join public.platform_account_restrictions restriction
      on restriction.user_id = profile.id
    where profile.id = target_user_id
      and coalesce(profile.is_bot, false) = false
      and profile.deactivated_at is null
      and profile.deleted_at is null
      and profile.deletion_requested_at is null
      and coalesce(profile.is_deleted, false) = false
      and (
        restriction.user_id is null
        or restriction.status = 'active'
        or (
          restriction.status = 'temporarily_banned'
          and coalesce(restriction.expires_at, restriction.restricted_until) is not null
          and coalesce(restriction.expires_at, restriction.restricted_until) <= now()
        )
      )
  );
$$;

comment on function public.publisher_profile_is_active_account(uuid) is
  'True when the profile is present, not bot/deactivated/deleted, and platform_account_restrictions is absent, active, or an expired temporary ban.';

create or replace function public.largest_owned_active_community_stats(target_user_id uuid)
returns table (
  community_id uuid,
  community_name text,
  active_member_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    community.id,
    community.name,
    (
      select count(distinct membership.user_id)::integer
      from public.community_members membership
      where membership.community_id = community.id
        and public.publisher_profile_is_active_account(membership.user_id)
        and public.is_active_community_media_member(community.id, membership.user_id)
    ) as active_member_count
  from public.communities community
  where community.owner_id = target_user_id
    and community.archived_at is null
  order by active_member_count desc, community.created_at asc
  limit 1;
$$;

comment on function public.largest_owned_active_community_stats(uuid) is
  'Largest non-archived community owned via communities.owner_id. Active members = COUNT(DISTINCT community_members.user_id) that pass publisher_profile_is_active_account and is_active_community_media_member. Owner is counted only when a membership row exists; no automatic +1. Does not read community_members.status (column does not exist).';

revoke all on function public.largest_owned_active_community_stats(uuid) from public, anon;
grant execute on function public.largest_owned_active_community_stats(uuid) to authenticated;

revoke all on function public.publisher_profile_is_active_account(uuid) from public, anon;
grant execute on function public.publisher_profile_is_active_account(uuid) to authenticated;

commit;
