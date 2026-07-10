# Task 299 - Screen share preview and stop controls

## Result

- The source picker displays a Stop sharing action whenever the local user is sharing.
- Local preview cards show the selected source label and a second always-visible Stop sharing control.
- Source labels are trimmed and limited to 80 characters; Electron source IDs are not displayed.
- Remote LiveKit screen-share tracks remain rendered as separate participant preview cards.
- Local and remote previews use participant names already provided by the voice snapshot.
- Capture still begins only after explicit source loading, source selection, and Start sharing.

## Validation

- `npm run screen-share:preview:test`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual checks

1. Join a configured voice room and explicitly choose a screen/window source.
2. Start sharing and confirm the local preview shows the safe source label.
3. Stop from both the picker header and preview footer; confirm the track and preview clear.
4. Join from a second client and confirm its remote share appears once with the participant label.
5. Confirm opening the voice room does not trigger a capture prompt.

Live local/remote media verification requires configured LiveKit credentials and is not claimed by the static smoke test.
