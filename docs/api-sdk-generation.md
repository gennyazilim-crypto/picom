# API SDK Generation Plan

Picom currently uses a typed frontend service layer, Supabase client calls, and the shared DTO package added for safe frontend/backend contracts. This plan defines how we reduce API drift without replacing the existing working service layer too early.

## Goals

- Keep Supabase mode and mock mode stable while API contracts evolve.
- Avoid duplicated request and response shapes between renderer services and backend/Supabase surfaces.
- Generate or validate types from a single source where practical.
- Keep generated code out of React components.
- Keep sensitive server-only fields out of desktop renderer types.

## Non-goals for the MVP

- No heavy API generator dependency until an OpenAPI spec exists.
- No replacement of the current Supabase client or existing service abstractions.
- No direct Prisma/database entity types in the renderer.
- No public bot/plugin/developer API generation in MVP.

## Current contract sources

- Supabase database types: generated with `npm run supabase:types` when the Supabase CLI is available.
- Shared safe DTOs: `packages/shared/src/dto`, `packages/shared/src/types`, `packages/shared/src/events`, and `packages/shared/src/permissions`.
- Renderer service layer: `src/services/**`, which should remain the only place UI-facing components call data APIs.
- Documentation: API compatibility and error-shape docs define expected behavior for future HTTP/Edge Function endpoints.

## Recommended strategy

### Phase 1: MVP typed service layer

Use the existing service layer plus the shared DTO package.

- Keep React components importing service functions and safe DTO types only.
- Keep Supabase generated database types inside the data access layer.
- Map database rows into DTOs before returning data to UI code.
- Use the shared `ApiErrorShape`, `PaginationResponse`, `PermissionKey`, and realtime event types for cross-cutting contracts.
- Add focused smoke checks for DTO safety rather than generating a new client.

This is the safest current path because Picom does not yet have a stable OpenAPI spec for all Edge Functions and API endpoints.

### Phase 2: OpenAPI foundation for Edge Functions/API endpoints

When backend HTTP endpoints and Edge Functions stabilize, introduce an OpenAPI document as the source of truth.

Recommended file locations:

- `docs/openapi/picom-api.yaml` for the human-reviewed API contract.
- `packages/shared/src/generated/` for generated TypeScript types if generation is adopted.
- `src/services/api/generated/` only if the generated client is small and wrapper-friendly.

Generation rules:

- Generated output must not be edited manually.
- Generated clients must be wrapped by Picom service modules.
- Generated models must be reviewed for sensitive fields before renderer use.
- The generator should run in CI as a check, not silently rewrite code during normal builds.

Potential future script:

```bash
npm run generate:api-client
```

Do not add this script until an OpenAPI spec and generator are chosen.

### Phase 3: Contract tests

Add lightweight contract checks before making code generation mandatory.

- Validate common response envelopes.
- Validate pagination shape:
  - `items`
  - `nextCursor`
  - `previousCursor`
  - `hasMore`
  - `limit`
- Validate error shape:
  - `code`
  - `message`
  - `details`
  - `requestId`
- Validate auth/session handling expectations.
- Validate realtime event payloads against shared event types.

## SDK shape

The future generated SDK, if adopted, should expose low-level transport only. Picom should keep domain services as the public app API.

Recommended layering:

```text
React components
  -> src/services/domainService.ts
    -> src/services/api/apiClient.ts or Supabase client wrapper
      -> generated API client or Supabase SDK
        -> network/backend
```

React components should not choose between mock and Supabase/API data sources directly.

## DTO safety rules

Shared renderer-safe DTOs must never include:

- `passwordHash`
- `tokenHash`
- raw session tokens
- refresh tokens
- service-role keys
- object storage secrets
- email verification tokens
- password reset tokens
- private admin-only metadata

If a backend entity contains those fields, the service layer must map it into a safe DTO before returning it.

## Error handling contract

Generated or manual clients should normalize errors into Picom's shared error shape:

```ts
type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
};
```

User-facing UI should receive formatted, non-technical messages from error helpers and diagnostics should retain only redacted developer details.

## Pagination contract

List endpoints should use the shared pagination shape:

```ts
type PaginationResponse<T> = {
  items: T[];
  nextCursor?: string | null;
  previousCursor?: string | null;
  hasMore: boolean;
  limit: number;
};
```

Message history, notifications, search, reports, saved messages, account activity, and admin lists should converge on this shape where possible.

## Supabase-specific guidance

- Continue using `supabase:types` for database schema typing.
- Keep generated Supabase database types scoped to Supabase data access.
- Use explicit DTO mapping before passing data into UI state.
- Do not expose Supabase service-role operations in the renderer.
- Edge Functions should be typed with request/response DTOs from `packages/shared` where practical.

## CI/checks placeholder

The recommended quality gate before generated clients are adopted:

```bash
npm run shared:types:check
npm run shared:types:smoke
npm run api:sdk:smoke
npm run typecheck
```

When OpenAPI exists, add:

```bash
npm run generate:api-client -- --check
```

## Decision

For the MVP, Picom will use a manually maintained typed service layer backed by shared safe DTOs and Supabase generated database types. OpenAPI-generated clients are deferred until the API surface is stable enough to justify generator maintenance.

## Open TODOs

- Choose an OpenAPI generator only after an OpenAPI contract exists.
- Define which Supabase Edge Functions need generated request/response wrappers.
- Add contract tests for the highest-risk endpoints before replacing manual wrappers.
- Keep documentation synced with `docs/api-compatibility.md` and shared DTO changes.
