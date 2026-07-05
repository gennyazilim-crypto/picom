# Community Onboarding Checklist

Picom includes a lightweight onboarding checklist for community owners and admins. It helps a new community reach the first usable setup state without adding post-MVP admin complexity.

## Scope

- Visible only to Owner/Admin roles in the desktop CommunitySidebar.
- Uses local state for completed and dismissed checklist status.
- Does not expose the checklist to normal members.
- Does not require Supabase or backend migrations.

## Checklist items

- Set community icon
- Add description
- Create first channel
- Invite people
- Set rules
- Configure roles
- Send first message
- Configure notifications placeholder

## Persistence

Checklist state is stored locally under `picom.communityOnboarding.v1`, keyed by community and user. It is safe to reset and does not store secrets, tokens, messages, or member personal data.

## Future backend path

When backend community settings are ready, the same item ids can be stored server-side as owner/admin setup state. The current local version is intentionally small and desktop-only.
