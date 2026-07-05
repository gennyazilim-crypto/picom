# Shared Types Package

Picom now has a lightweight shared types package at `packages/shared`. It is intentionally type-only and does not change runtime imports yet.

## Purpose

- Reduce frontend/backend DTO drift.
- Provide safe public DTOs that exclude secrets and database-only fields.
- Prepare future API SDK generation and Edge Function type sharing.

## Current contents

- `UserDTO`
- `CommunityDTO`
- `ChannelDTO`
- `MessageDTO`
- `AttachmentDTO`
- `MemberDTO`
- `RoleDTO`
- `NotificationDTO`
- `PermissionKey`
- `ApiErrorDTO`
- `PaginatedResponse`
- `RealtimeEvent`

## Security rules

Shared DTOs must never include:

- password hashes
- token hashes
- auth tokens
- refresh tokens
- cookies
- Supabase service-role keys
- LiveKit secrets
- signing keys
- private server-only fields

## Current integration decision

The package is not wired into app imports yet. This avoids broad path alias/workspace changes while the MVP build remains single-package. Future tasks can import from `@picom/shared` after workspace/build configuration is intentionally added.

## Validation

Run:

```powershell
npm run shared:types:check
npm run shared:types:smoke
```
