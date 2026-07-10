# Task 347 checkpoint: Bundle splitting and lazy loading

## Completed

- Preserved lazy Profile, Mention Feed and Settings route boundaries.
- Split StoryViewerModal from the story header/list path.
- Removed ChatMain's unreachable duplicate voice implementation and deferred the App-owned VoiceRoomView.
- Grouped community admin tools into one deferred chunk to avoid over-splitting small panels.
- Added a production asset audit that verifies each intended chunk after build.

## Safety

- Existing App voice state/actions, story callbacks and community permission checks remain authoritative.
- No mobile UI, visual redesign, secret, token or backend authorization change was introduced.
- Core auth, titlebar, community sidebar and text-chat paths remain immediate.

## Remaining issue

- Shared diagnostics and Settings dependencies keep `voiceService` in a shared/static graph; the existing warning remains documented pending measured packaged benefit.
- The large main renderer chunk remains tracked by the startup performance budget.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run bundle:splitting:audit`
- `npm run bundle:size`
