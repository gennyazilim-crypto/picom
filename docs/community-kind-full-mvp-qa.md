# Community Kind Full MVP QA

Task 444 closes the local, hosted-ready architecture audit for independently created Text, Radio, and Podcast communities.

## Scope matrix

| Contract | Text | Radio | Podcast |
| --- | --- | --- | --- |
| Typed creation wizard and idempotent request ID | PASS | PASS | PASS |
| Default roles and starter data | PASS | PASS | PASS |
| Owner, admin, moderator, member, visitor boundaries | PASS | PASS | PASS |
| ServerRail routing and last-view restoration | channel route | Radio section/session | Podcast section/episode |
| Typed invite preview and join landing | channel | Radio overview | Podcast library |
| Public/private and block/ban join enforcement | PASS | PASS | PASS |
| Ownership transfer and recoverable archive | shared atomic lifecycle RPC | shared atomic lifecycle RPC | shared atomic lifecycle RPC |
| Cross-kind isolation | PASS | PASS | PASS |

Legacy communities are backfilled to `text`; the legacy Text channel/category behavior is not rewritten by the Radio or Podcast templates.

## Lifecycle safety

- `transfer_community_ownership` locks the community and target membership, requires the current owner and exact-name confirmation, assigns the target Owner role, demotes the previous owner safely, and appends audit evidence in one transaction.
- `archive_community` is the destructive-action boundary. It retains community, child, audit, and security records while disabling discovery/public access and recording the actor and reason.
- Restrictive RLS guards hide archived community metadata and primary child content from normal clients.
- Service components use the shared data-source layer. Renderer components do not call Supabase directly.
- Recovery is intentionally an operator-controlled database procedure; normal application flows cannot silently restore or hard-delete archived communities.

## Automated local evidence

`npm run community:kind-full-mvp:qa` composes the existing source-of-truth contracts for:

- domain/backfill and all three creation templates
- route separation and per-kind route memory
- role permissions, visitor access, public/private reads, invite/join/leave boundaries
- ownership transfer, recoverable archive, audio community surfaces
- Supabase schema and structural RLS coverage

The full task validation also runs typecheck, mock smoke, production build, QA smoke, visual/E2E coverage contracts, and renderer performance budgets.

## Hosted execution boundary

The pgTAP suite `supabase/tests/rls/community_lifecycle_management.sql` is transaction-local and safe for local or staging Supabase. Structural validation is required on every local run. Real pgTAP execution is `BLOCKED` when the Supabase CLI/local database is unavailable and must never be reported as passed without execution.

## Manual desktop checklist

1. Create one Text, one Radio, and one Podcast community from the actual creation wizard.
2. Switch among them in ServerRail and confirm each restores only its own last route.
3. Exercise owner/admin/moderator/member/visitor menus for each kind.
4. Verify visitors cannot see private content and blocked/banned accounts cannot join.
5. Transfer ownership to an existing member and verify the previous owner loses owner-only controls.
6. Archive a disposable test community by exact-name confirmation and verify its content disappears without deleting audit history.

Live Electron pointer interaction and hosted Supabase execution remain separate evidence runs; static contracts are not described as screenshots or hosted success.
