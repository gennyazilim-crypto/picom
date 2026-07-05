# Channel Category Management Placeholder

Picom prepares local category management for community owners/admins without changing backend ownership or Supabase permissions yet.

## Current behavior

- Owners/admins see a Categories management card in the community sidebar setup area.
- Categories can be created locally.
- Categories can be renamed locally.
- Categories can be deleted locally only when another category remains.
- Deleting a category moves its channels into the first remaining category instead of deleting channels.

## Future production requirements

- Supabase API/RLS must enforce `manageChannels` permissions.
- Category create/edit/delete/reorder should use backend transactions.
- Deleting a category should explicitly move channels to uncategorized or require server-confirmed destination.
- Multi-client realtime updates should broadcast category list changes.

## Manual verification

1. Open Picom in mock mode as an owner/admin user.
2. Use the Categories card in the CommunitySidebar.
3. Add a category.
4. Rename a category.
5. Delete a category and confirm channels remain available.