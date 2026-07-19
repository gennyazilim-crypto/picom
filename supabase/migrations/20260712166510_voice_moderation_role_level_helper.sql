-- Task 665: provide the hierarchy helper required by the qualified Voice moderation RPC.
begin;

create or replace function public.community_user_max_role_level(target_community_id uuid,target_user_id uuid)
returns integer
language sql stable security definer set search_path=public,pg_temp as $$
  select case
    when exists(
      select 1 from public.communities community
      where community.id=target_community_id and community.owner_id=target_user_id
    ) then 32767
    else coalesce((
      select max(role.level)
      from public.community_members member
      join public.roles role on role.community_id=member.community_id and (
        role.id=member.role_id
        or exists(
          select 1 from public.community_member_roles role_link
          where role_link.member_id=member.id and role_link.role_id=role.id
        )
      )
      where member.community_id=target_community_id and member.user_id=target_user_id
    ),-1)
  end;
$$;

revoke all on function public.community_user_max_role_level(uuid,uuid) from public,anon,authenticated;
comment on function public.community_user_max_role_level(uuid,uuid) is 'Security-definer Voice moderation hierarchy helper; owner invariant and multi-role maximum only.';;
