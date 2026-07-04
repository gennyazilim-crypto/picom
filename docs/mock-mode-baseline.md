# Task 075 - Mock mode baseline

Picom mock mode baseline is established after Task 074.

## Baseline source state

- Baseline commit before this marker: `159881f`
- Data source default: `VITE_DATA_SOURCE=mock`
- Runtime target: Electron desktop for Windows, Linux, and macOS
- UI scope: MVP desktop community chat shell

## Included in this baseline

- Typed community, channel, member, role, message, attachment, and reaction data.
- Deterministic mock message timestamps.
- Local message append state.
- MVP app state for active community and channel selection.
- Safe fallback community/channel selection.
- Overlay state for settings, command palette, context menu, profile popover, image preview, and toasts.
- Persisted member sidebar visibility state.
- Avatarpack fallback avatars for users without a profile image.

## Baseline expectations

- The app remains usable without Supabase or LiveKit configured.
- No mobile UI is introduced.
- No Discord branding, logos, copied assets, or exact colors are used.
- Future backend work should preserve mock mode as the safe local development path.

## Manual smoke test

1. Start the app in mock mode.
2. Switch community.
3. Switch channel.
4. Send a local message.
5. Toggle member sidebar.
6. Open settings, command palette, context menu, profile popover, and image preview.
7. Confirm light/dark theme remains stable.
