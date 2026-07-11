# Task 475 Checkpoint: Profile Full MVP QA

## Delivered

- Profile Full MVP aggregate QA contract and evidence matrix.
- Visual variants for current verified, other unverified, blocked, public, private, and empty-media profiles.
- Expanded E2E profile preflight contract covering Tasks 470–474.
- Replaced profile activity's log-only placeholder with real channel navigation and message highlighting.
- Preserved truthful `planned` UI runner and `contract_only` pixel baseline status.

## Commands

- `npm run profile:full-mvp:qa`
- all profile preflight commands listed in the E2E manifest
- `npm run visual:regression:contract`
- `npm run e2e:coverage:contract`
- `npm run supabase:rls:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run qa:supabase`
- `npm run performance:budget:ci`

Pixel UI automation, hosted pgTAP, and real staging Storage/multi-client evidence remain BLOCKED until their runners and credentials are available. No success is claimed for those external gates.
