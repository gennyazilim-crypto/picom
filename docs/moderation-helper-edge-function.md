# Moderation helper Edge Function placeholder

Task 199 prepares a trusted Supabase Edge Function boundary for future moderation workflows.

## Function

```text
supabase/functions/moderation-helper/index.ts
```

Request shape:

```json
{
  "communityId": "uuid",
  "targetId": "message-or-member-id",
  "action": "delete_message",
  "reason": "optional moderator reason"
}
```

Supported placeholder actions:

- `delete_message`
- `kick_member`
- `ban_member`
- `timeout_member`

## Current behavior

The function validates auth presence, `communityId`, `targetId`, and action type, then returns:

```json
{
  "code": "MODERATION_HELPER_NOT_IMPLEMENTED",
  "message": "Moderation helper is prepared but not enabled yet.",
  "details": {
    "action": "delete_message",
    "applied": false
  }
}
```

## Why placeholder only

Moderation requires audited permission checks, durable moderation records, and careful RLS/RPC design. A fake successful moderation action would be dangerous because users could believe safety actions were applied when they were not.

## Future implementation checklist

- Verify the authenticated user is a community owner/admin/moderator.
- Check the action-specific permission.
- Prevent moderation of owners by lower roles.
- Write audit/moderation records inside the trusted boundary.
- Soft-delete messages rather than hard-delete where possible.
- Use typed `errorResponse()` bodies for rejected or placeholder actions.
- Never store message content, tokens, passwords, or authorization headers in logs.

## Supabase configuration

```toml
[functions.moderation-helper]
verify_jwt = true
```

## Manual verification

When Supabase CLI is available:

```powershell
supabase functions serve moderation-helper
```

Call with a valid user token:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:54321/functions/v1/moderation-helper `
  -Headers @{ Authorization = "Bearer USER_ACCESS_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"communityId":"COMMUNITY_UUID","targetId":"TARGET_ID","action":"delete_message"}'
```

Expected for now: HTTP `501` with `MODERATION_HELPER_NOT_IMPLEMENTED`.
