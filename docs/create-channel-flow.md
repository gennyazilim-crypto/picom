# Create Channel Flow

Task 149 adds the first MVP create-channel flow while preserving the desktop-only Picom shell.

## Scope

- Opens a desktop modal from the `+` action on a category header.
- Normalizes channel names before sending them to the service.
- Calls `channelService.createChannel()` so mock mode and Supabase mode stay behind the service boundary.
- Adds the created channel into local UI state immediately.
- Switches the active channel to the newly created channel.

## Mock mode behavior

When `VITE_DATA_SOURCE=mock`, `channelService.createChannel()` returns a deterministic local channel summary. The UI adds it to the selected category and selects it.

## Supabase mode behavior

When `VITE_DATA_SOURCE=supabase`, the flow inserts into `public.channels` using the configured Supabase client. RLS remains the source of truth for authorization.

## Manual verification

1. Start the app.
2. Sign in with a development user.
3. Hover a channel category in the community sidebar.
4. Click the `+` button on the category row.
5. Enter a channel name with spaces, for example `Design Reviews`.
6. Confirm the preview normalizes it to `design-reviews`.
7. Create the channel.
8. Confirm it appears in the selected category and becomes the active channel.
9. Confirm the four-column desktop layout remains stable.