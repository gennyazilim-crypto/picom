# Notification fanout Edge Function placeholder

Task 200 prepares a Supabase Edge Function boundary for future server-side notification fanout.

## Function

```text
supabase/functions/notification-fanout/index.ts
```

Request shape:

```json
{
  "eventType": "message_mention",
  "communityId": "optional-community-uuid",
  "channelId": "optional-channel-uuid",
  "messageId": "optional-message-uuid"
}
```

Supported placeholder event types:

- `message_mention`
- `direct_message`
- `community_announcement`
- `system_notice`

## Current behavior

The function validates auth presence and event shape, then returns:

```json
{
  "code": "NOTIFICATION_FANOUT_NOT_IMPLEMENTED",
  "message": "Notification fanout is prepared but not enabled yet.",
  "details": {
    "eventType": "message_mention",
    "delivered": false
  }
}
```

## Why placeholder only

Notification fanout should respect user preferences, muted communities/channels, mentions-only mode, Do Not Disturb, and future inbox/native notification routing. A placeholder prevents accidental notification spam while keeping the trusted boundary ready.

## Future implementation checklist

- Verify the triggering user/session.
- Resolve recipients using RLS-safe queries or trusted server-side checks.
- Respect user notification settings.
- Avoid sending notifications for active focused channels when appropriate.
- Store notification inbox records if that table is introduced.
- Use typed `errorResponse()` bodies for rejected or placeholder fanout requests.
- Avoid logging message content, tokens, passwords, authorization headers, or private payloads.

## Supabase configuration

```toml
[functions.notification-fanout]
verify_jwt = true
```

## Manual verification

When Supabase CLI is available:

```powershell
supabase functions serve notification-fanout
```

Call with a valid user token:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:54321/functions/v1/notification-fanout `
  -Headers @{ Authorization = "Bearer USER_ACCESS_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"eventType":"message_mention"}'
```

Expected for now: HTTP `501` with `NOTIFICATION_FANOUT_NOT_IMPLEMENTED`.
