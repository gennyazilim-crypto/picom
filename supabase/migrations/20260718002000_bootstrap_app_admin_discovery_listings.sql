-- Bootstrap trusted Picom-owned public communities into Discovery.
--
-- This intentionally does not list arbitrary public communities. Only active,
-- publicly-readable communities owned by an existing app administrator are
-- eligible. Normal communities must continue to use the owner opt-in and
-- protected review queue.

do $$
declare
  candidate record;
begin
  for candidate in
    select community.id, community.owner_id
    from public.communities community
    join public.app_admins administrator on administrator.user_id = community.owner_id
    where community.visibility = 'public'
      and community.public_read_enabled = true
      and community.archived_at is null
  loop
    update public.communities
    set discovery_listed = true,
        category = coalesce(category, 'work'),
        discovery_join_policy = coalesce(discovery_join_policy, 'open'),
        updated_at = now()
    where id = candidate.id;

    insert into public.community_discovery_reviews(
      community_id,
      status,
      reviewed_by,
      review_note,
      reviewed_at,
      updated_at
    )
    values(
      candidate.id,
      'approved',
      candidate.owner_id,
      'Initial Picom-owned public Discovery listing.',
      now(),
      now()
    )
    on conflict (community_id) do update
      set status = 'approved',
          reviewed_by = excluded.reviewed_by,
          review_note = excluded.review_note,
          reviewed_at = excluded.reviewed_at,
          updated_at = excluded.updated_at;

    insert into public.audit_log(
      community_id,
      actor_id,
      action_type,
      target_type,
      target_id,
      reason
    )
    values(
      candidate.id,
      candidate.owner_id,
      'discovery_review',
      'community_discovery_listing',
      candidate.id,
      'Initial Picom-owned public Discovery listing approved.'
    );
  end loop;
end;
$$;
