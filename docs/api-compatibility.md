# API Deprecation and Compatibility Policy

Picom is an Electron desktop app for Windows, Linux, and macOS. Backend changes must keep released desktop clients working across dev, beta, and stable channels unless a planned compatibility gate says otherwise.

## Versioning strategy

- Desktop app releases use semantic versioning: `major.minor.patch`.
- Public API and Supabase schema changes are tracked against the minimum supported desktop client version.
- Breaking backend changes must update release notes, migration notes, and client/server compatibility metadata.
- Additive changes should be preferred over breaking changes.

## What counts as a breaking change

- Removing or renaming fields consumed by the desktop client.
- Changing a response field type.
- Changing error response shape.
- Tightening RLS or permission rules without a desktop fallback or planned migration.
- Renaming Supabase tables, columns, buckets, channels, or realtime event payload fields used by the client.
- Changing LiveKit token Edge Function request/response shape.
- Requiring a newer desktop client without updating remote config and release notes.

## Additive change policy

- New fields may be added when existing clients can safely ignore them.
- New endpoints, RPCs, Edge Functions, and realtime events should not alter existing behavior.
- Optional fields should remain optional until all supported desktop clients know how to handle them.
- New enum values require a safe unknown-state fallback in the client.

## Deprecation process

1. Mark the API/schema/event as deprecated in docs.
2. Add replacement guidance.
3. Keep the deprecated path working for at least one beta cycle unless it is a security emergency.
4. Announce the planned removal in release notes.
5. Update smoke tests or QA docs.
6. Remove only after the minimum supported desktop version has moved past affected clients.

## Enforced compatibility headers

First-party Edge Function JSON responses expose safe public headers:

- `X-Picom-API-Version: 1`
- `X-Picom-API-Revision: 2026-07-10`
- `X-Picom-Min-Client-Version: <public semver>`
- `X-Picom-Recommended-Client-Version: <public semver>`

Desktop requests send `X-Picom-API-Version` and `X-Picom-Client-Version`. Missing API headers remain accepted for previously released clients; an explicitly conflicting API major fails with the stable `VALIDATION_ERROR` shape. Deprecated contracts additionally use:

- `Deprecation: true`
- `Sunset: <RFC 7231 date placeholder>`
- `Link: <replacement-doc-url-placeholder>; rel="deprecation"`

Do not include secrets, private deployment details, or internal admin-only config in compatibility headers.

The `client-config` response remains authoritative for blocking minimum-version UI. Headers are advisory compatibility metadata and never replace authentication, RLS, permissions, kill switches, or signed release/update validation.

## Error shape compatibility

All API errors should follow the shared shape:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "A user-friendly error message.",
  "details": {},
  "requestId": "optional-request-id"
}
```

- `code` should remain stable.
- `message` may be localized or improved, but should stay safe for users.
- `details` must be optional and non-sensitive.
- Stack traces must not be exposed to normal desktop clients.

## Pagination compatibility

List endpoints should use:

```json
{
  "items": [],
  "nextCursor": null,
  "previousCursor": null,
  "hasMore": false,
  "limit": 50
}
```

Existing unpaginated MVP paths should be documented before changing to cursor pagination.

## Realtime event compatibility

- Realtime event names should be stable.
- Payloads may add optional fields.
- Payloads should include IDs needed for deduplication and reconciliation where available.
- Removing fields or changing event names is breaking.
- Unknown event types should be ignored safely by the client.

## Desktop auto-update relationship

- Production auto-update is not enabled yet.
- Future updater rollout must coordinate with API compatibility windows.
- Remote config may recommend an update, but API permission/security checks must remain backend-enforced.

## Emergency exceptions

Security fixes may remove or disable vulnerable behavior immediately. When this happens:

- Document the exception.
- Use feature flags or kill switches where available.
- Update minimum supported client metadata if older clients cannot operate safely.
- Add release notes and incident follow-up.

## Release checklist impact

Before beta/stable release:

- Confirm API changes are additive or documented as breaking.
- Confirm remote config minimum/recommended versions are correct.
- Confirm Supabase RLS changes do not leak or block valid MVP flows.
- Confirm realtime payload changes do not duplicate or drop messages.
- Confirm LiveKit token changes are compatible with the current renderer.
