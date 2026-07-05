# Report Management Foundation

Picom's report management system is currently a local MVP placeholder. It prepares the frontend structure for reported messages and users without enabling a production moderation backend yet.

## Current behavior

- Message context menu includes `Report message` for other users' active messages.
- Member context menu includes `Report user` for other users.
- User profile popover includes a `Report` action.
- Reports are stored in a local in-memory placeholder queue through `reportService`.
- Admin Operations placeholder shows a redacted report summary in development mode.
- Report logs use `loggingService` and only include safe metadata such as report id, target type, status, community id, and channel id.

## Current files

- `src/types/reports.ts`
- `src/services/reportService.ts`
- `src/components/AdminOperationsPanel.tsx`
- `src/components/UserProfilePopover.tsx`
- `src/App.tsx`

## Not implemented yet

- Supabase `reports` table.
- RLS policies for report submission and moderation review.
- Moderator report queue UI.
- Audit log entries for report review actions.
- Backend permission enforcement for report review.

## Production requirements

- Users can submit reports for messages, users, and communities.
- Moderators/admins can view reports only where they have moderation permission.
- Backend must enforce permissions; frontend visibility is not security.
- Report records must not contain passwords, tokens, auth headers, service-role keys, LiveKit secrets, or private message content beyond permitted moderation context.
- Report status transitions should create audit log entries.
