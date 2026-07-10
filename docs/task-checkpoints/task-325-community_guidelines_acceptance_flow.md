# Task 325 - Community guidelines acceptance flow

Status: implemented with safe hosted rollout gate.

- Public join modal displays published, versioned rules and requires explicit acceptance when enabled.
- Mock acceptance persists timestamp/version only after a successful join.
- Supabase migration adds rules, safe RLS management, and atomic server timestamp/version evidence.
- Discovery no longer bypasses the join confirmation.
- Existing hosted communities remain disabled by default; invite-version support and final legal review are documented blockers before enablement.

Validation:
- `npm run community:guidelines:acceptance:test`
- `npm run community:access:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
