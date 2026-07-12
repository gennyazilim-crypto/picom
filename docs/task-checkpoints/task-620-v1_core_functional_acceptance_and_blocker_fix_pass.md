# Task 620 Checkpoint - V1 Core Functional Acceptance

## Result

- Targeted local V1 contracts: **PASS** after two stale smoke updates.
- Hosted Supabase end-to-end acceptance: **BLOCKED**.
- Installed Windows candidate acceptance: **BLOCKED** until Task 624.

## Targeted audit

Twenty V1-focused smoke scripts were selected rather than running the full release suite. Eighteen passed immediately. The DM script still expected the removed `onOpenDirectMessages` ServerRail prop even though DM is now routed through the centralized V1 registry. The support script expected a retired direct Voice service call instead of the current redacted aggregate diagnostics registry. Both assertions were corrected without changing product behavior.

Covered locally: scope/data-source gates, First Launch, Auth/onboarding, Feed, text community template/join, role access/management, attachments, replies, read state, profile media, friends, DM, settings, support, diagnostics and installer branding.

## Evidence policy

No hosted or installed-candidate success is claimed. See `docs/v1-core-functional-acceptance.md` for the row-by-row matrix and blockers.

## Remaining V1 blockers

1. Protected hosted staging environment and synthetic fixtures.
2. Passing real staging actor, Storage, Realtime and Edge matrices.
3. Clean installed Windows candidate startup/restart acceptance.
