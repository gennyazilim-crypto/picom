# Developer Portal Placeholder

Picom's Developer Portal is a post-MVP foundation for users who will later manage integrations such as bots, webhooks, and application registrations. This task intentionally keeps the portal as a documented placeholder so the current Full MVP desktop chat UI remains stable.

## Status

- Phase: post-MVP advanced product foundation
- Runtime availability: disabled by default
- Intended visibility: development mode or app-admin flag only
- Production readiness: not ready for public users

## Goals

- Define a safe future area for integration management.
- Keep bot, webhook, and application concepts separated from normal community settings.
- Avoid exposing unfinished or sensitive controls to regular users.
- Provide a path for future Supabase-backed developer resources without changing the current MVP flow.

## Non-goals

- No public developer marketplace.
- No real API key issuance.
- No production bot runtime.
- No webhook production launch.
- No plugin runtime or arbitrary code execution.
- No mobile UI.

## Future frontend placeholder

When enabled later, the Developer Portal should be reachable only from safe internal entry points:

- Settings > Advanced, development-only placeholder.
- User menu, development-only placeholder.
- Command Palette, development-only placeholder.

Planned sections:

- My Bots
- Webhooks
- Applications
- API Keys placeholder
- Documentation placeholder

Every entry point must be hidden unless one of these is true:

- `VITE_APP_ENV=development`
- a future `enableDeveloperPortal` feature flag is enabled for internal testers
- the signed-in user has an app-admin/developer permission from the backend

## Future backend placeholder routes

These routes are intentionally documented only. They must require auth and server-side authorization before implementation.

```http
GET /developer/apps
POST /developer/apps
PATCH /developer/apps/:appId
DELETE /developer/apps/:appId
```

Expected safe application DTO shape:

```ts
export type DeveloperAppDTO = {
  id: string;
  ownerUserId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string | null;
};
```

Do not include raw API keys, bot tokens, token hashes, secrets, auth headers, or provider credentials in any frontend DTO.

## Security rules

- Never expose raw API keys after creation; future one-time display must be explicit and copy-safe.
- Never store passwords, personal access tokens, or signing secrets in local settings.
- Do not let frontend feature flags act as the only security boundary.
- Backend authorization must enforce app ownership and app-admin access.
- Logs must redact tokens, authorization headers, and secret-like fields.
- Any future delete/revoke action must be confirmed and auditable.

## Desktop UI rules

- Keep the current Picom desktop shell unchanged.
- No mobile layout or bottom navigation.
- Use AppIcon/Coolicons only when the view is implemented later.
- Use design tokens for all future surfaces.
- Keep this separate from community admin settings.

## Manual verification

Until runtime UI exists, verify this placeholder by checking:

1. This document clearly marks the Developer Portal as post-MVP.
2. No production credentials or real API keys are included.
3. Existing MVP UI entry points are not changed.
4. Smoke script passes.

## TODO before implementation

- Add a typed feature flag key such as `enableDeveloperPortal`.
- Add Supabase tables or Edge Functions only after API-key and bot-token policy is finalized.
- Add backend authorization tests before exposing any portal route.
- Add UI only after MVP chat/auth/community flows are stable.
