# Task 124 Checkpoint: Public API Versioning

## Result

Created a unified future versioning policy for Picom bot APIs, webhook APIs, first-party Edge Functions, and integration events. No API was published or enabled.

## Decisions

- Major version in URL (`/v1`) is authoritative; safe version/revision/request headers supplement it.
- Bot/webhook/event DTOs are explicit and backend/RLS scoped.
- Shared safe error shape and stable machine-readable codes are mandatory.
- Rate-limit headers and `Retry-After` define client behavior; unsafe retries require idempotency.
- Public stable deprecation targets a 12-month notice only after formal launch commitment; beta/first-party windows are separately gated.
- Breaking changes require new major/adapter and old/new client contract tests.
- Security emergencies may disable behavior immediately with incident, safe error, communication, and migration/hotfix evidence.

## Validation

- Documentation-only; existing Edge Functions, desktop services, bot/webhook foundations, and UI behavior are unchanged.
- `npm run typecheck`
- `npm run mock:smoke`

## Remaining public-launch gates

- Approved external API scope/terms/owners
- Versioned OpenAPI/event schemas and contract tests
- Production credential issuance, RLS, rate limits, audit/abuse/revocation
- Developer docs/SDK/support/monitoring and staged rollout

