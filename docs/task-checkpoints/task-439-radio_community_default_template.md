# Task 439 - Radio Community Default Template

## Status

Implemented a dedicated Full MVP Radio community shell and atomic station bootstrap for mock and Supabase data sources.

## Delivered

- Radio creation uses a stable request UUID and the atomic `create_radio_community_with_defaults` RPC.
- Bootstrap creates Owner, Radio Host, and Member roles with station-specific capabilities.
- The creator receives Owner membership; retries restore the invariant without duplication.
- `radio_community_settings` starts with a safe UTC schedule, announcements enabled, and Listener Chat disabled.
- No fake broadcast, program, category, or text channel is seeded.
- `radio_programs` and `radio_announcements` provide RLS-protected station structures.
- `radioCommunity` is a dedicated app view and `RadioCommunityShell` fills the space after ServerRail without CommunitySidebar.
- Live Now, Schedule, Shows & Programs, Hosts, and Announcements are primary station navigation.
- Listener Chat is rendered only when a manager has explicitly enabled it and linked a protected channel.
- Mock Radio communities receive matching Owner/Radio Host/Member role definitions.

## Security and rollback

- The renderer never supplies an owner ID; the RPC derives ownership from `auth.uid()`.
- Internal bootstrap is not executable by client roles.
- Station settings/program/announcement policies use existing community-audio visibility and capability helpers.
- PostgreSQL transaction semantics roll back the community, roles, membership, and station settings together on failure.
- The pgTAP contract covers public authenticated read access, denied visitor updates, idempotent retries, and forced child-insert rollback.

## Evidence

- `npm run community:radio-template:smoke` validates routing, shell identity, service boundaries, role defaults, SQL/RLS markers, and rollback coverage.
- `supabase/tests/rls/radio_community_default_template.sql` is the real isolated database test.
- Real pgTAP execution is BLOCKED when Supabase CLI/local database is unavailable; static contract checks are not reported as hosted database evidence.
- Live Electron interaction remains a manual check when no UI automation runner is active.

## Manual test path

1. Create a Radio community from the typed wizard.
2. Confirm ServerRail opens the dedicated Radio shell directly.
3. Confirm CommunitySidebar and the normal text category tree are absent.
4. Navigate Live Now, Schedule, Shows & Programs, Hosts, and Announcements.
5. Confirm the empty UTC schedule has no fake show.
6. Confirm the creator is listed as Owner/host-capable and Listener Chat is hidden.
7. Retry the same request UUID against isolated staging and confirm one station exists.

## Remaining external validation

- Apply migrations to isolated Supabase staging and run the pgTAP file.
- Exercise create/retry/access in two Electron windows against staging before release certification.
