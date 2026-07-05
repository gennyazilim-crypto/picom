# Task 403: Moderation appeals placeholder

## Scope
- Documentation-only production operations task.
- No runtime code, UI, Electron shell, Supabase client, or LiveKit behavior changed.

## Completed
- Created `docs/moderation-appeals.md`.
- Documented future appeal goals, non-goals, Supabase model placeholder, service/API placeholders, RLS expectations, UI entry points, audit requirements, abuse prevention, and open decisions.
- Clearly marked the feature as not production-enabled in the MVP.

## Verification
- Confirmed the moderation appeals document exists.
- Confirmed it includes RLS expectations and audit/logging requirements.
- Confirmed no secrets, real credentials, tokens, or private user data were added.

## Manual test steps
1. Open `docs/moderation-appeals.md`.
2. Confirm it clearly marks appeals as a future placeholder.
3. Confirm it defines safe RLS boundaries for users, moderators, admins, and app admins.
4. Confirm it does not claim a production appeals workflow exists today.
