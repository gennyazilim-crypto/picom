# Task 684 Checkpoint: Unified Text, Radio, and Podcast Mention Cards

Status: Complete  
Date: 2026-07-12

## Delivered

- Shared Feed card shell, identity/context header, truthful reason label, social-proof footer, and unavailable fallback.
- Text body with validated image/video media grid and ImagePreview callback.
- Radio body with live/scheduled/ended state, host context, cover, listeners, duration, and Listen/Open action.
- Podcast body with cover, title, author context, duration, plays, and Play/Open action.
- Real reaction pills, comment counts, commenter stack, two safe comment previews, read/save actions, and source deep links.
- Approved-only verification summary batch and existing Picom `VerifiedBadge` integration; verification never affects score/reason.
- Keyboard focus, accessible labels, token-only light/dark surfaces, no horizontal overflow, and medium desktop density.
- One unified component family; no source-specific Supabase calls or independent ranking logic.

## Validation

- `npm run feed:cards:v1:smoke`
- `npm run feed:service:v1:smoke`
- `npm run typecheck`
- `npm run build`

## Integration boundary

- Card actions are callback-driven and become the active Mention Feed renderer in Task 685.
- Existing ImagePreview and AudioPlayer coordinators are consumed by those callbacks; this task does not duplicate modal/player state.
- Hosted source/verification evidence remains pending Task 688.
