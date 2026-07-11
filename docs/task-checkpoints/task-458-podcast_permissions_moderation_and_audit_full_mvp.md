# Task 458 Checkpoint: Podcast Permissions, Moderation, and Audit

Date: 2026-07-11

## Result

Completed the Full MVP Podcast permission, moderation, report, copyright notice, and append-only audit foundation.

## Implemented

- Centralized Publisher, Editor, comment-moderator, and episode-moderator access in the common community capability model.
- Removed Podcast UI access fallback based only on role names.
- Preserved the hierarchy-safe common role assignment RPC and its `role_change` audit event.
- Added a desktop Podcast Moderation section with target-aware report queue controls.
- Separated Editor/comment moderation from Owner/Admin episode moderation.
- Added episode and comment report entry points to Podcast detail.
- Added `copyright` as a bounded report reason and linked Acceptable Use / Community Guidelines from the Publisher workspace.
- Added mock-mode permission rejection and audit parity for Podcast publishing lifecycle and moderation.
- Added service-backed comment soft deletion and episode unpublish/archive moderation.
- Added Supabase target validation, target-aware report RLS, report identity immutability, and server-side report transition validation.
- Added database audit evidence for publish, unpublish, archive, delete, comment/episode moderation, and Podcast report decisions.
- Prevented soft-deleted Podcast comments from being selected through normal RLS.
- Added pgTAP-shaped structural tests and a deterministic feature smoke test.

## Role behavior

- Owner/Admin: publish, metadata, archive/delete, episode moderation, comment moderation, and Podcast report review.
- Podcast Publisher: draft/media/publish/metadata/archive/series access; no moderation capability implied by the label.
- Podcast Editor: metadata and comment moderation; no media replacement, publication state, deletion, or episode report access.
- Moderator: comment moderation only when the stored database role contains `moderatePodcastComments`.
- Member/visitor: no moderation or private production access.

## Commands and results

- `npm run typecheck` - PASS
- `npm run podcast:moderation:smoke` - PASS
- `npm run podcast:publishing:smoke` - PASS
- `npm run podcast:interactions:smoke` - PASS
- `npm run podcast:integration:smoke` - PASS
- `npm run podcast:data-model:smoke` - PASS
- `npm run community:role-assignment:test` - PASS
- `npm run reports:production:test` - PASS
- `npm run audit-logs:immutability:smoke` - PASS
- `npm run audit-logs:admin-review:test` - PASS
- `npm run content:reporting:ux:test` - PASS
- `npm run community:kind-permissions:smoke` - PASS
- `npm run community:kind-full-mvp:qa` - PASS (structural; live RLS skipped)
- `npm run mock:smoke` - PASS
- `npm run supabase:smoke` - PASS (structural)
- `npm run build` - PASS
- `npm run qa:smoke` - PASS
- `npm run performance:budget:ci` - PASS

Performance evidence:

- Initial JS: 1525.5 KiB (under 1650.0 KiB hard cap)
- Initial CSS: 227.3 KiB (under 240.0 KiB hard cap)
- Largest image: 734.6 KiB (under 768.0 KiB hard cap)
- Total assets: 2975.0 KiB (under 3500.0 KiB hard cap)
- Generated assets: 35

## Manual validation

No interactive Electron window test was run in this task. The navigation, report entry points, moderation dialog, capability separation, policy links, and responsive desktop CSS were validated through TypeScript, production build, deterministic source contracts, and existing QA gates.

## Blocked external evidence

The Supabase CLI is unavailable. Migration application, pgTAP execution, and live Owner/Admin/Publisher/Editor/Moderator/member/visitor RLS verification remain BLOCKED. These are not reported as passed and must run in the protected hosted-validation workflow before release.

## Remaining non-blocking warnings

- Vite reports the existing ineffective `voiceService` dynamic import.
- Initial JS/CSS and total assets exceed preferred targets but remain below enforced hard caps.
- Authorized legal approval for copyright/contact/takedown language remains a separate release No-Go item.
