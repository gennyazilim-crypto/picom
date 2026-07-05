# Private Channel Permission UI Placeholder

Picom prepares private channel role-selection UI without making the renderer the security source of truth.

## Current behavior

- Create Channel includes a Private channel toggle.
- When enabled, a compact allowed-roles placeholder appears.
- Owner/Admin/Moderator roles are selected by default.
- Created private channels store local placeholder role IDs for future backend integration.
- The sidebar still shows lock icons for private channels.

## Future production requirements

- Supabase RLS and trusted channel permission records must enforce private channel access.
- Message search must not return private channel messages to unauthorized users.
- Realtime room joins must validate membership and channel visibility.
- Renderer-side hiding is only UX; backend remains the source of truth.

## Manual verification

1. Open Create Channel from a category add button.
2. Toggle Private channel.
3. Confirm allowed role pills appear.
4. Create the channel.
5. Confirm the channel appears with the lock icon and the app remains stable.