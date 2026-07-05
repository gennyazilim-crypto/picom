# Channel Reorder UI Placeholder

Picom prepares lightweight channel ordering controls for owner/admin users without implementing drag-and-drop yet.

## Current behavior

- Owner/admin users see compact up/down controls beside channel rows.
- Reordering updates local mock state immediately.
- Active channel selection remains unchanged.
- The sidebar remains fixed and compact.

## Future production requirements

- Supabase API/RLS should enforce `manageChannels` before reorder writes.
- Reorder operations should persist per category and update `position` values atomically.
- Multi-client realtime should broadcast channel order changes.
- Drag-and-drop can be added later if it does not hurt desktop accessibility.

## Manual verification

1. Open Picom in mock mode as an owner/admin user.
2. Hover over a channel row in the CommunitySidebar.
3. Use up/down controls.
4. Confirm channel order changes and the active channel remains selected.