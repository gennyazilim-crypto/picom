-- Task 443: safe typed invite previews and join restrictions shared by every community kind.

create or replace function public.get_community_invite_preview(invite_code text)
returns table(
  community_id uuid,
  community_name text,
  community_kind public.community_kind,
  description text,
  visibility text,
  member_count bigint,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_code text := lower(btrim(invite_code));
  target_invite public.community_invites%rowtype;
  target_community public.communities%rowtype;
begin
  if normalized_code is null or normalized_code !~ '^[a-z0-9_-]{8,64}$' then raise exception 'INVITE_INVALID' using errcode = '22023'; end if;
  select * into target_invite from public.community_invites invite where lower(invite.code) = normalized_code;
  if not found then raise exception 'INVITE_INVALID' using errcode = '22023'; end if;
  if target_invite.revoked_at is not null then raise exception 'INVITE_REVOKED' using errcode = '22023'; end if;
  if target_invite.expires_at is not null and target_invite.expires_at <= now() then raise exception 'INVITE_EXPIRED' using errcode = '22023'; end if;
  if target_invite.max_uses is not null and target_invite.uses >= target_invite.max_uses then raise exception 'INVITE_EXHAUSTED' using errcode = '22023'; end if;
  select * into target_community from public.communities community where community.id = target_invite.community_id;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode = '22023'; end if;
  if auth.uid() is not null and exists (select 1 from public.community_bans ban where ban.community_id = target_community.id and ban.user_id = auth.uid() and ban.revoked_at is null) then raise exception 'INVITE_BANNED' using errcode = '42501'; end if;
  if auth.uid() is not null and public.users_are_blocked(auth.uid(), target_community.owner_id) then raise exception 'INVITE_BLOCKED' using errcode = '42501'; end if;
  return query select target_community.id, target_community.name, target_community.kind, target_community.description,
    target_community.visibility, (select count(*) from public.community_members member where member.community_id = target_community.id), target_invite.expires_at;
end;
$$;

revoke all on function public.get_community_invite_preview(text) from public;
grant execute on function public.get_community_invite_preview(text) to anon, authenticated;

create or replace function public.enforce_community_membership_join_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target_owner_id uuid;
begin
  if exists (select 1 from public.community_bans ban where ban.community_id = new.community_id and ban.user_id = new.user_id and ban.revoked_at is null) then
    raise exception 'JOIN_BANNED' using errcode = '42501';
  end if;
  select community.owner_id into target_owner_id from public.communities community where community.id = new.community_id;
  if target_owner_id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = '23503'; end if;
  if new.user_id <> target_owner_id and public.users_are_blocked(new.user_id, target_owner_id) then
    raise exception 'JOIN_BLOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists community_members_join_restrictions on public.community_members;
create trigger community_members_join_restrictions
before insert on public.community_members
for each row execute function public.enforce_community_membership_join_restrictions();

comment on function public.get_community_invite_preview(text) is
  'Returns only safe invite preview metadata, including canonical community kind; never returns the invite code, role internals, private channels, or member identities.';
comment on function public.enforce_community_membership_join_restrictions() is
  'Authoritative INSERT guard for active community bans and owner/user blocking relationships across public joins, invite joins, and administrative membership paths.';
