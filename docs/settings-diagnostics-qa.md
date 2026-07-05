# Settings Diagnostics QA

Settings > Advanced is the user-facing entry point for beta feedback and diagnostics export.

## Command

```powershell
npm run settings:diagnostics:smoke
```

`npm run qa:smoke` includes this check.

## Required Settings controls

- feedback placeholder title/description
- include diagnostics toggle
- include recent redacted logs toggle
- save feedback placeholder
- export diagnostics JSON

## Required service behavior

- diagnostics payload is created by `feedbackService`
- feedback draft text is redacted before export
- recent logs come from `loggingService`
- app/runtime/service status comes from `diagnosticsService`

## Manual QA

- Open Settings > Advanced.
- Enter feedback text.
- Toggle diagnostics/log inclusion.
- Export diagnostics JSON.
- Confirm payload is useful and redacted.
