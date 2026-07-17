-- Discovery opt-in — the missing owner-facing control.
--
-- Root cause found 2026-07-17: Discovery is permanently EMPTY because a community can never
-- enter the discovery review queue. The flow requires community.discovery_listed = true (plus
-- visibility='public', public_read_enabled=true) to auto-enqueue a pending review (existing
-- trigger requeue_discovery_listing_on_profile_change), which a moderator then approves. But
-- `discovery_listed` defaults to false and NO RPC/UI ever sets it true — so nothing is ever
-- listed, the queue is always empty, and list_public_discovery_communities returns [].
--
-- This adds the owner/admin-gated setter. Auth pattern mirrors update_community_settings
-- (is_community_owner OR has_community_role_level >= 80). Setting listed=true also forces the
-- community public + publicly-readable so it satisfies the discovery predicate; the existing
-- trigger then enqueues it for review. Removing (listed=false) delists it immediately.
--
-- DEPLOY: apply to the app backend `ufmtvqtsklqsmqxefbbs` (Codex), then wire the client call
-- + a "List in Discovery" settings toggle (see docs/ops/GO-LIVE-handoff.md).

create or replace function public.set_community_discovery_listing(
  target_community_id uuid,
  next_listed boolean,
  next_category text default null,
  next_join_policy text default null
)
returns setof public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.communities%rowtype;
begin
  if auth.uid() is null
     or not (public.is_community_owner(target_community_id) or public.has_community_role_level(target_community_id, 80)) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if next_category is not null and next_category not in ('development','design','gaming','music','study','work') then
    raise exception 'DISCOVERY_CATEGORY_INVALID' using errcode = '22023';
  end if;
  if next_join_policy is not null and next_join_policy not in ('open','request') then
    raise exception 'DISCOVERY_JOIN_POLICY_INVALID' using errcode = '22023';
  end if;
  if next_listed and next_category is null then
    -- a listed community must be categorised so it can be browsed/filtered
    if not exists (select 1 from public.communities c where c.id = target_community_id and c.category is not null) then
      raise exception 'DISCOVERY_CATEGORY_REQUIRED' using errcode = '22023';
    end if;
  end if;

  update public.communities set
    discovery_listed = next_listed,
    visibility = case when next_listed then 'public' else visibility end,
    public_read_enabled = case when next_listed then true else public_read_enabled end,
    category = coalesce(next_category, category),
    discovery_join_policy = coalesce(next_join_policy, discovery_join_policy),
    updated_at = now()
  where id = target_community_id
  returning * into updated;

  if updated.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = '22023'; end if;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values (
    updated.id, auth.uid(), 'community_update', 'community', updated.id,
    public.redact_audit_reason(
      case when next_listed then 'Community listed in Discovery (pending moderator review)'
           else 'Community removed from Discovery' end)
  );

  return next updated;
end;
$$;

revoke all on function public.set_community_discovery_listing(uuid, boolean, text, text) from public, anon;
grant execute on function public.set_community_discovery_listing(uuid, boolean, text, text) to authenticated;

comment on function public.set_community_discovery_listing(uuid, boolean, text, text) is
  'Owner/admin opt-in that lists a community in Discovery (forces public + public_read, enqueues a pending review via the requeue trigger) or delists it.';
