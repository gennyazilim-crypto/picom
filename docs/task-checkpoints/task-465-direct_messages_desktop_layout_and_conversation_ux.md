# Task 465 Checkpoint: Direct Messages Desktop Layout and Conversation UX

## Completed

- Consolidated three conflicting DM style layers into one canonical component stylesheet.
- Finalized the 280px sidebar, centered readable chat, and 312px details hierarchy.
- Constrained header, thread, attachments, and composer to a shared 880px axis.
- Kept short conversations bottom-aligned while preserving independent long-thread scrolling.
- Preserved coherent avatar, author, reply, attachment, reaction, timestamp, edited, and sent/read-state grouping.
- Made the details control a real accessible disclosure: inline on wide desktop and an overlay below 1320px.
- Strengthened conversation search, active/unread hierarchy, shared media, mutual communities, and privacy actions.
- Explicitly kept DM avatars on the medium non-aura verification variant; Task 468 remains the canonical verification contract owner.
- Preserved all DM data, realtime, Supabase, and Electron behavior.

## Validation contract

- `npm run dm:layout:smoke`
- `npm run dm:services:realtime:smoke`
- `npm run dm:production:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

## Manual desktop checks

The required Electron visual pass covers 1440px, 1280px, and the existing 1100px minimum: no horizontal overflow, bottom-aligned short threads, normal long-thread scroll, details collapse/overlay, search, conversation switching, composer, reactions, replies, attachment preview, mute, and archive. Native visual evidence remains BLOCKED until the Electron window is observed interactively; automated contracts do not fabricate that result.

## Observed local results

- PASS: DM centered desktop layout and grouping smoke
- PASS: DM services/realtime contract smoke
- PASS: DM production contract smoke
- PASS: TypeScript typecheck
- PASS: Mock mode smoke
- PASS: Electron/renderer production build
- PASS: Picom deterministic QA smoke gate
- PASS: Renderer performance hard caps (`initialJs 1547.1 KiB`, `initialCss 229.6 KiB`, `totalAssets 2998.2 KiB`)
- PASS: DM lazy stylesheet reduced from approximately `24.8 KiB` to `18.2 KiB`
- BLOCKED: interactive native Electron visual observation at 1440px/1280px/1100px
