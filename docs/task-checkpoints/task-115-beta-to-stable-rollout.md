# Task 115 Checkpoint: Beta-to-Stable Rollout

## Result

Documented the evidence-based process for promoting Picom desktop beta artifacts to stable.

## Covered gates

- Beta feedback review and known-issue triage
- Security and Supabase RLS sign-off
- LiveKit voice/screen-share sign-off
- Platform package, checksum, provenance, signing, and notarization sign-off
- Legal/privacy and support readiness
- Final release notes, Go/No-Go, and staged stable rollout

## Safety boundary

Missing live RLS evidence, platform package evidence, required signing/notarization, legal approval, or unresolved blocker produces `blocked`/`No-Go`. This documentation does not enable auto-update or publish artifacts.

## Validation

- Documentation-only change; runtime behavior is unchanged.
- `npm run typecheck`
- `npm run mock:smoke`

