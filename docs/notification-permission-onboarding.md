# Notification Permission Onboarding

Picom should not request notification permission immediately on startup. Permission prompts are user-friendly only after the user has context for why notifications help.

## Trigger moments

The onboarding prompt can appear after:

- creating a community
- sending the first message
- opening Settings > Notifications

The prompt does not appear on app startup.

## Current behavior

- `notificationPermissionOnboardingService` stores prompt state locally.
- Dismissal persists locally.
- Permission requests use `notificationService.requestPermission()`.
- Unsupported runtimes do not show the prompt.
- Already granted/denied permission does not show the prompt.
- The UI is a compact desktop prompt, not a mobile sheet.

## Benefits copy

The prompt explains:

- mentions
- direct messages placeholder
- important updates

## Test steps

Run:

```bash
npm run notifications:permission-onboarding:smoke
npm run react:hooks:smoke
npm run typecheck
npm run build
```

Manual checks:

1. Start the app and confirm no permission prompt appears immediately.
2. Open Settings > Notifications and confirm the prompt appears only when browser/native permission is `default`.
3. Dismiss the prompt and confirm it does not immediately return.
4. Reset local onboarding state if needed with `notificationPermissionOnboardingService.reset()` from diagnostics/dev tools later.
5. Click Allow notifications and confirm the request goes through `notificationService`.

