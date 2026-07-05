# Community Delete Safety Placeholder

Picom prepares community deletion as an owner-only, confirmation-protected placeholder. The renderer does not delete communities, channels, messages, members, attachments, or audit records.

## Current behavior

- Current owners see a Delete safety card in the community sidebar setup area.
- The owner must type the exact community name before preparing the placeholder.
- The placeholder records local intent only.
- Existing community data remains visible and unchanged.

## Future production requirements

- Real deletion must be a trusted backend/Supabase operation.
- Require owner permission server-side.
- Prefer soft deletion with `deletedAt` so audit history can be retained.
- Prevent access to soft-deleted communities once backend support exists.
- Clean up realtime rooms and active client state after successful backend deletion.
- Require a final confirmation and clear warning before destructive production behavior.

## Manual verification

1. Sign in as/mock a community owner.
2. Open a community sidebar.
3. Confirm Prepare delete is disabled until the exact community name is typed.
4. Prepare the placeholder and confirm no community disappears.
5. Clear the placeholder.