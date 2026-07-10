# Task 389 Checkpoint: Profile Audio Sections

## Result

Extended Full Profile Page with visible Hosted Radio, published Podcast Episodes,
current-user Saved Audio, and audio activity stats while preserving all existing
profile sections and verified avatar behavior.

## Behavior

- Listen/Play selects a local AudioMiniPlayer without autoplay.
- Open community uses the existing App community navigation callback.
- Save state is local and reversible.
- Audio rows are filtered to communities already visible to the current viewer.
- Restricted profiles still return the existing limited-profile state before any
  audio content is evaluated/rendered.

## Deferred

Production profile audio visibility and persistence require Supabase RLS-backed
queries. No Supabase, Storage, or LiveKit connection was added here.
