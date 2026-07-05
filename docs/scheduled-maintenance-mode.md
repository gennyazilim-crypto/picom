# Scheduled Maintenance Mode

Picom has a small scheduled maintenance foundation for the desktop client and Supabase Edge Function health response.

## Client behavior

- Mock mode stays operational and skips remote maintenance checks.
- Supabase mode checks the public `health` Edge Function on startup.
- `status: "maintenance"` shows a blocking desktop maintenance screen below the custom titlebar.
- `status: "degraded"` shows a subtle non-blocking banner.
- Failed status checks degrade safely instead of crashing the renderer.

## Health response shape

```json
{
  "ok": true,
  "status": "operational",
  "message": "Picom services are operational.",
  "startedAt": null,
  "estimatedEndAt": null
}
```

Supported statuses:

- `operational`
- `degraded`
- `maintenance`

## Production notes

- This is a placeholder foundation.
- The health function must not expose secrets, tokens, internal stack traces, or private infrastructure details.
- Future scheduled maintenance control can come from a safe remote config source or protected operations workflow.
