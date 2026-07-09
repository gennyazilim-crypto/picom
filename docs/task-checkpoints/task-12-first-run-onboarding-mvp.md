# Task 12 - First-Run Onboarding MVP

## Status

Implemented for the Picom Electron desktop app.

## Delivered

- Six-step desktop onboarding wizard: welcome, profile, start choice, follow suggestions, theme, and finish.
- Local persistence in mock mode and Supabase profile persistence when configured.
- Existing Supabase profiles are backfilled as complete; newly created profiles default to incomplete.
- Own-profile RLS remains the enforcement boundary for onboarding updates.
- Follow suggestions use existing safe mock members and remain local until a `user_follows` table is introduced.
- Completion updates profile settings, theme, followed users, and the initial Picom destination.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Manual test

1. Run Picom in mock mode and register or sign in.
2. Clear `picom:first-run-onboarding:v1:mock-current-user` from local storage to repeat the flow.
3. Complete all six steps and verify the selected theme applies immediately.
4. Restart the app and verify the wizard does not appear again.
5. In Supabase staging, apply migration `20260704002700_profiles_onboarding.sql`, register a new account, and verify only that account can update its onboarding fields.
