# Profile Editing

Task 284 adds local profile editing foundation.

## Current behavior

- Settings > Profile allows editing:
  - display name
  - status text
  - bio
- Changes are persisted locally through `settingsService`.
- The current desktop user's visible member card/profile data updates immediately in the active community shell.
- Profile edits can be reset locally.

## Boundaries

This task does not add:

- Supabase profile persistence
- Avatar upload
- Username changes
- Global profile sync across clients
- Moderation review for profile content
- Mobile UI

## Future backend requirements

Before production profile editing is enabled, Supabase should enforce:

- Authenticated user can update only their own profile.
- Display name and bio validation.
- Avatar upload validation and storage access rules.
- Abuse/moderation handling for profile text.
- Realtime profile update fanout if multi-client sync is enabled.

## Manual test steps

1. Run `npm run dev`.
2. Open Settings.
3. Go to Profile.
4. Change display name, status text, and bio.
5. Save locally.
6. Confirm UserMiniCard and current user profile surfaces update.
7. Reset local profile.
8. Confirm mock profile values return.
