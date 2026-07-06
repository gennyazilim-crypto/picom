# Read Receipts Placeholder

Picom read receipts are prepared as an opt-in privacy placeholder. They are separate from delivery receipts.

## Current behavior

- Settings > Privacy & Safety already exposes a `Read receipts placeholder` toggle.
- The setting is stored locally through `userSafetyCenterService`.
- When enabled, current user's messages show a small `Reads on` placeholder indicator.
- Other users' messages do not show detailed read information.
- No per-message reader list is exposed.
- No Supabase write path is added in this task.

## Privacy rules

- Read receipts default off.
- Users should control whether their own read activity can be shared.
- Large communities should not show invasive detailed reader lists by default.
- Community policy may later disable read receipts entirely.
- Supabase RLS must protect any future receipt rows.

## Future implementation path

- Reuse existing `read_states` for channel-level read position.
- Add a separate per-message read receipt table only after privacy review.
- Emit receipt updates through Supabase Realtime only when both user preference and community policy allow it.
- Keep delivery receipts and read receipts visually distinct.

## Test steps

Run:

```bash
npm run read-receipts:smoke
npm run react:hooks:smoke
npm run typecheck
npm run build
```

Manual checks:

1. Open Settings > Privacy & Safety.
2. Enable Read receipts placeholder.
3. Confirm current user's messages show the compact read receipt indicator.
4. Disable the setting and confirm the indicator disappears after the app state updates.
5. Confirm no detailed reader list is shown.

