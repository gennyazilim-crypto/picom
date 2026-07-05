# Multi-Account Placeholder

Status: post-MVP service foundation

Picom now has a small `accountSwitcherService` foundation for future multi-account switching. The service stores only local account metadata and does not store credentials or auth tokens.

## Stored metadata

- `userId`
- `displayName`
- `username`
- `avatarUrl` optional
- `lastUsedAt`

## Not stored

- passwords
- Supabase access tokens
- refresh tokens
- session cookies
- authorization headers
- recovery codes
- private account secrets

## Behavior

- Account metadata is stored in localStorage under a Picom-specific key.
- Up to six account metadata entries are retained.
- Existing single-account auth flow is unchanged.
- Switching accounts still requires a valid future session or re-authentication.

## Future UI placeholder

Potential future entry points:

- UserMiniCard menu > Switch account
- UserMiniCard menu > Add account
- Account Switcher modal
- Login prompt when a selected account session is expired

## Security boundaries

- Auth tokens remain centralized in the auth/session layer.
- Account metadata must be considered non-secret but still privacy-sensitive.
- The service must not be used to bypass Supabase Auth.
- If a session is revoked, switching to that account must require login again.

## Manual verification

- Confirm the app still supports the existing single-account login flow.
- Confirm no multi-account UI appears in the current MVP shell.
- Confirm the service file does not store passwords or tokens.
