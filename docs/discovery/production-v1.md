# Community Discovery Production v1

## Status

Picom Discovery v1 is staged for reviewed public community profiles. Mock mode remains usable with local communities. Supabase mode fails closed: no community is returned without public visibility, public-read permission, explicit discovery listing, and an approved review record.

## Public profile contract

Discovery returns only:

- Community ID.
- Name and description.
- Icon URL/initial fallback and accent color.
- Bounded category.
- Aggregate member count.
- Join policy (`open` or `request`).

It does not return member profiles, private channels, messages, attachments, roles, invite secrets, audit logs, owner contact details, or internal moderation notes.

## Listing eligibility

The backend `list_public_discovery_communities` RPC requires every condition:

- `communities.visibility = 'public'`.
- `public_read_enabled = true`.
- `discovery_listed = true`.
- `community_discovery_reviews.status = 'approved'`.

The security-definer RPC uses an explicit safe projection and filters; it never returns private/unreviewed rows. Result limit is clamped to 1-60. Search text is trimmed/bounded and applied only to name/description.

No existing community is automatically approved by the migration. Operators must review and approve listings through protected backend operations before production discovery shows them.

## Search and categories

The desktop view provides local filtering over the safe result set:

- Name/description search.
- Development.
- Design.
- Gaming.
- Music.
- Study.
- Work.

Search does not query messages, members, channels, or private metadata. No mobile layout or marketplace ranking is introduced.

## Join and request access

`join_or_request_discovery_community` rechecks approval and public/listed/read conditions using `auth.uid()`.

- `open`: inserts the authenticated user with the default Member role.
- `request`: inserts or safely reopens a pending `community_join_requests` record.
- Existing members receive `already_member`.
- Missing approval, private/unlisted community, missing auth, or missing default role fails safely.

The join/request RPC is granted to authenticated users only. Join request tables have RLS enabled and no direct anon/authenticated table grants.

Private communities never use this flow; they remain invite/approval mechanisms outside Discovery.

## Reporting

Every card includes a Report action that opens Picom's existing community report modal. Reports are authenticated and use the existing report service/RLS path. The card itself does not expose private moderation context.

## Approval and moderation plan

`community_discovery_reviews` is backend/app-admin controlled and intentionally unavailable to normal renderer roles. A future restricted review queue should provide:

- Listing identity and safe public profile preview.
- Policy/content category flags.
- Reviewer decision and bounded internal note.
- Re-review after material name/description/icon/category changes.
- Suspension/unlisting action independent of community deletion.
- Append-only audit event for submit/approve/reject/suspend.
- Report/abuse signal summary without exposing unrelated private content.

Community owners cannot self-approve by changing community columns.

## Anti-spam controls

Before stable enablement:

- Rate-limit listing submissions, join requests, search calls, and reports.
- Limit name/description/icon/category changes that trigger re-review.
- Detect duplicate/near-duplicate communities with bounded metadata.
- Require account age/verification thresholds where policy approves.
- Apply abuse-event logging without message content or raw IP storage.
- Limit aggregate result size and paginate future larger indexes.
- Add emergency unlisting/Discovery kill switch enforced by backend and UI.
- Monitor join/request/report rates with content-free metrics.

## Privacy and isolation

- Private communities cannot appear even if a stale review row exists.
- Unapproved/rejected/pending listings cannot appear.
- Member count is aggregate only.
- Opening a community still depends on channel/message RLS.
- Report, Mention Feed, Profile, and deep links must recheck visibility and membership.
- Discovery flags never replace authentication or permissions.

## Current limitations

- Review UI and app-admin approval mutation are not implemented in this task.
- Production Supabase results remain empty until review rows are approved out of band.
- Ranking is member-count/newest only inside the safe RPC; no behavioral personalization exists.
- Join-request review UI is not implemented.
- Mock mode uses local approved-like communities for desktop interaction testing.
- Real migration/RPC behavior requires Supabase CLI or staging verification.

## Production test matrix

- Approved public/listed/read-enabled community appears.
- Pending/rejected/unreviewed community does not appear.
- Private community never appears, even with stale approved review row.
- Public but unlisted or public-read-disabled community does not appear.
- Search/category returns only eligible rows.
- Open join creates one member with default role and does not duplicate.
- Request policy creates one pending request and does not duplicate.
- Anonymous join/request is rejected.
- Report action creates only an authorized report.
- Deep link/channel/message RLS remains enforced after discovery navigation.

