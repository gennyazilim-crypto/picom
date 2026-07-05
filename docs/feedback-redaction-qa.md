# Feedback Redaction QA

User-entered feedback text can accidentally contain sensitive values. Picom redacts feedback draft fields before exporting diagnostics.

## Core files

- `src/services/loggingService.ts`
- `src/services/feedbackService.ts`
- `scripts/diagnostics-redaction-smoke-test.mjs`

## Behavior

- Feedback title and description are included only after diagnostics redaction.
- Recent logs are already redacted by `loggingService`.
- Diagnostics snapshot does not include auth tokens or provider secrets.

## Manual QA

- Open Settings > Advanced.
- Enter feedback text containing examples like `password=example` or `Authorization: Bearer example`.
- Export diagnostics JSON.
- Confirm those values are redacted before sharing.

## Command

```powershell
npm run diagnostics:smoke
```
