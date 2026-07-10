# Task 66 - Polls MVP+

- Added poll, option, and vote schemas with channel-visibility RLS.
- Added compact poll creation modal from composer Poll button and `/poll`.
- Poll creation uses the existing message send/permission path before attaching poll metadata.
- Added compact poll message cards with counts, progress bars, multiple-choice option, and close-time state.
- Added local/API vote, unvote, and single-choice vote-change behavior.
- Added poll vote Realtime publication foundation.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
