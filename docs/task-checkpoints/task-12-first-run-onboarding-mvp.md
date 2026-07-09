# Task 12 - First-Run Onboarding MVP

## Status

Implemented for the Picom Electron desktop app.

## Delivered

- Five-step desktop onboarding: Profile, Theme, Community, Follow, and Finish.
- Required display name plus optional username and status text.
- Immediate light/dark theme selection.
- Create community, join by invite, or continue-without-community choices as safe MVP entry options.
- Eight mock follow suggestions with multi-select local state that feeds Mention Feed behavior.
- Back, Next, and optional-step Skip controls with a 1-5 progress indicator.
- Local mock persistence and Supabase profile persistence through `profiles.onboarding_completed`.
- Existing Supabase profiles remain backfilled as complete; new profiles default to incomplete.
- Finish always marks onboarding complete and redirects to Mention Feed.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Manual test

1. Run Picom in mock mode and sign in.
2. Clear `picom:first-run-onboarding:v1:mock-current-user` from local storage to repeat the flow.
3. Complete the profile step and verify display name/status update after finish.
4. Switch theme and verify it applies immediately.
5. Exercise every community choice and optional-step Skip control.
6. Select several suggested users and verify the followed-users feed changes after finish.
7. Restart Picom and verify onboarding is skipped once complete.
8. In Supabase staging, apply `20260704002700_profiles_onboarding.sql` and verify only the signed-in profile can update its onboarding fields.

