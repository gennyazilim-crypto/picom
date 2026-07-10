create table if not exists public.announcement_channel_followers (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(channel_id,user_id)
);
alter table public.announcement_channel_followers enable row level security;
grant select,insert,delete on public.announcement_channel_followers to authenticated;
create policy "announcement_followers_self_select" on public.announcement_channel_followers for select to authenticated using(user_id=auth.uid());
create policy "announcement_followers_self_insert" on public.announcement_channel_followers for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.channels channel where channel.id=channel_id and channel.type='announcement' and public.is_community_member(channel.community_id) and public.can_view_channel(channel.id)));
create policy "announcement_followers_self_delete" on public.announcement_channel_followers for delete to authenticated using(user_id=auth.uid());

create or replace function public.can_send_message_to_channel(target_channel_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.channels channel
    where channel.id=target_channel_id and public.can_view_channel(channel.id) and (
      channel.type='text' or (
        channel.type='announcement' and (
          public.is_community_owner(channel.community_id) or exists(
            select 1 from public.community_members member join public.roles role on role.id=member.role_id
            where member.community_id=channel.community_id and member.user_id=auth.uid()
              and (role.level>=80 or coalesce((role.permissions->>'sendAnnouncements')::boolean,false))
          )
        )
      )
    )
  );
$$;
grant execute on function public.can_send_message_to_channel(uuid) to authenticated;

comment on table public.announcement_channel_followers is 'User-owned delivery preference only. Cross-posting and external syndication are not supported.';
