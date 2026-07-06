# Staging Environment Smoke Test Workflow

Use this workflow before promoting Picom beta or stable releases. Picom is an Electron desktop app for Windows, Linux, and macOS backed by Supabase and LiveKit/WebRTC.

Do not use production secrets during staging smoke tests. Do not run destructive actions against production by accident.

## Scope

This checklist validates staging readiness before release promotion. It is separate from local mock smoke tests and production deployment approval.

## Required environment

- Staging Supabase project configured.
- Staging database migrations applied.
- Staging storage bucket configured for image attachments.
- Staging realtime enabled.
- Staging LiveKit/token function configured if voice is in the release candidate.
- Windows desktop package or dev build pointed at staging API.
- Linux desktop package or dev build pointed at staging API.
- macOS desktop package or dev build pointed at staging API when macOS release is in scope.

## Smoke test checklist

| Area | Check | Expected result | Result |
| --- | --- | --- | --- |
| Backend health | Call staging `/health`, `/health/live`, `/health/ready` | Live and ready checks pass | TODO |
| Database migration | Confirm latest migration applied | Schema version matches release candidate | TODO |
| Seed/staging data | Confirm safe staging users/communities exist | No production data required | TODO |
| Auth register | Register test user | User can create account and profile | TODO |
| Auth login | Login with staging test user | Session restores after restart | TODO |
| Create community | Create a staging community | Community appears in ServerRail | TODO |
| Create channel | Create text channel | Channel appears and can be selected | TODO |
| Send message | Send text message | Message appears with optimistic then confirmed state | TODO |
| Realtime two clients | Open two desktop clients/windows | Message/reaction/read updates appear in both | TODO |
| Upload attachment | Upload png/jpg/webp/gif below limit | Attachment renders and preview opens | TODO |
| Permissions | Try member/admin/private channel boundaries | Unauthorized actions are blocked | TODO |
| Notifications placeholder | Trigger mention/important notification path | Notification or inbox placeholder follows settings | TODO |
| Windows desktop | Connect Windows build to staging API | App starts, no native menu regression, chat works | TODO |
| Linux desktop | Connect Linux build to staging API | App starts, no native menu regression, chat works | TODO |
| macOS desktop | Connect macOS build to staging API when in scope | App starts and titlebar behavior is acceptable | TODO |
| No mobile UI | Resize within desktop minimum | Existing desktop warning only; no mobile nav/layout | TODO |
| No Discord branding | Inspect main screens and release notes | No Discord logos/assets/exact colors | TODO |

## Manual flow

1. Start staging backend and confirm health/readiness.
2. Apply migrations in staging and verify no pending migration remains.
3. Start the Windows desktop client pointed at staging.
4. Register or log in with a staging-only test account.
5. Create a community and channel.
6. Send text messages and image attachments.
7. Open a second desktop client/window and verify realtime updates.
8. Test private channel/member permission boundaries.
9. Repeat startup and core chat flow on Linux.
10. Repeat on macOS when macOS packaging is in the release ring.
11. Record failures with logs, request IDs, and redacted screenshots only.

## Safe script placeholder

`npm run staging:smoke:placeholder` is intentionally non-destructive by default. It prints the required checklist and refuses to call staging unless a future implementation adds explicit staging credentials and confirmation.

## Pass/fail criteria

Pass only if:

- Backend health/readiness pass.
- Database schema is current.
- Register/login/session restore work.
- Community/channel/message/upload flows work.
- Realtime works with two desktop clients.
- Permission boundaries block unauthorized access.
- Windows and Linux desktop clients connect to staging successfully.
- No mobile UI or Discord branding appears.

Fail or block promotion if:

- Any core chat flow fails.
- Private channel data leaks.
- Desktop app crashes on startup.
- Staging migration state is uncertain.
- Release cannot be rolled back safely.

## Related documents

- `docs/slo.md`
- `docs/incident-response.md`
- `docs/performance-budget.md`
- `docs/bundle-size.md`
- Production deployment checklist placeholder once available
