# User Safety Center

Picom's User Safety Center gathers user-facing safety controls in one desktop settings section without enabling advanced backend features prematurely.

## Current MVP behavior

- Entry point: Settings > Privacy & Safety.
- Blocking list reads from the existing local `userBlockingService`.
- Direct message and friend request controls are local placeholders.
- Online status and read receipt preferences are local placeholders.
- Data export and account deletion status link to existing safe placeholder services.
- Report a problem routes users to the existing Advanced > Beta support placeholder.

## Safety boundaries

- No passwords, tokens, cookies, auth headers, or private message content are stored.
- These frontend settings improve desktop UX only.
- Supabase Auth, RLS, and backend services must enforce production privacy and permission rules.
- Blocking, DM policy, friend request policy, and read receipt enforcement are future backend work.

## Future Supabase requirements

- Store safety preferences per user with RLS allowing only the owner to read/update them.
- Enforce block lists for DMs, friend requests, notifications, and profile visibility.
- Respect read receipt opt-in before creating per-message read receipt rows.
- Keep account deletion/export workflows backend-authorized.
- Audit safety-sensitive changes without storing private content.

## Manual QA

1. Open Settings.
2. Select Privacy & Safety.
3. Toggle online status and read receipt placeholders.
4. Change DM/friend request policies.
5. Confirm blocked users list renders an empty state or local entries.
6. Use Report a problem and confirm it moves to Advanced beta support.
