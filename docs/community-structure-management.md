# Type-aware community structure management

Task 495 completes the Community Admin structure surface without creating parallel content stores.

## Text communities

- Categories and text, voice, forum, or announcement channels are managed in one desktop panel.
- Category and channel order is persisted through security-definer RPCs and mirrored into local UI state only after success.
- Channel edit/delete continues to use the existing typed confirmation modals. Deleting the active channel returns the user to the first visible fallback channel.
- Private and public-read settings remain part of the canonical channel update RPC.
- Role-specific channel overrides use `community_permission_overrides`; only owners or roles with `managePermissionOverrides` can read or write them.
- The final category and final channel cannot be deleted.

## Radio communities

Compatible sections are Programs, Schedule, Hosts, and Listener chat. Programs and Schedule are required recovery routes. Optional sections can be removed and restored without deleting their linked Radio records.

## Podcast communities

Compatible sections are Series, Episodes, Drafts, Publishers, and Listener discussion. Series and Episodes are required recovery routes. Section visibility does not bypass Podcast episode or Storage RLS.

## Access and deletion

- UI checks improve affordances only. All Supabase writes call authenticated RPCs that enforce community kind and manager permissions.
- Section visibility supports `public`, `members`, and `managers`.
- Required sections cannot be disabled or deleted.
- Removing an optional section retains its authoritative content and moves the local selection to the first remaining section.
- Accessible Up and Down buttons are the supported ordering control; drag and drop is intentionally not required.

## Evidence

Run `npm run community:structure:smoke`. Live RLS execution still requires the Supabase CLI or an approved hosted staging environment.
