# Community Kind Schema and RLS Design

## Canonical domain

Picom Full MVP has exactly three community product spaces:

- `text`: channel-based community chat;
- `radio`: live/scheduled community radio;
- `podcast`: podcast publishing and episode playback.

**No hybrid** kind is part of Full MVP. Capability helpers are the UI/service boundary: `supportsTextChannels`, `supportsLiveRadio`, and `supportsPodcastPublishing`. A Radio or Podcast community must not be routed through the normal text-channel experience merely because identity, membership, and ownership fields are shared.

## Non-destructive migration

Migration `20260711000100_community_kind_domain.sql` creates `public.community_kind` and adds `public.communities.kind`.

- Existing rows are retained and classified as `text`.
- The column receives a `text` default and becomes `NOT NULL` only after the backfill.
- A pre-existing text column is converted only when all non-null values are valid.
- Unknown existing values abort with `COMMUNITY_KIND_MIGRATION_INVALID_EXISTING_VALUE`; they are not rewritten or discarded.
- PostgreSQL enum validation rejects invalid values at the database boundary.
- An index supports kind-specific lists without changing current identity or membership keys.

## Shared fields

All kinds continue to share community ID, owner, name, description, icon, accent, visibility, public-read policy, verification, membership, roles, invites, audit relationships, and timestamps. Type-specific content remains in its existing text/radio/podcast domain tables.

## RLS impact

The migration does not replace or weaken RLS. Existing community SELECT/INSERT/UPDATE policies continue to authorize rows by ownership, membership, visibility, and trusted RPC boundaries. The new enum is descriptive product routing data, not an authorization grant.

- Reading `kind` requires the same community row access as every other community field.
- Setting a kind during creation still requires the existing authenticated community INSERT policy.
- Membership, role, invite, private-channel, and public-read policies are unchanged.
- UI capability checks are UX only; RLS and kind-specific service policies remain the security boundary.
- Future kind-specific write policies must join through `communities.kind` and continue to verify owner/member permissions.

## Service behavior

Mock and Supabase list/create paths return the canonical kind. Existing callers that do not yet provide a kind create `text` communities for backward compatibility. Runtime validation rejects invalid values before a Supabase request; the PostgreSQL enum provides the final rejection boundary.

Community kind is immutable in the general settings service. A future conversion tool would require a separate audited migration workflow and is outside Full MVP.
