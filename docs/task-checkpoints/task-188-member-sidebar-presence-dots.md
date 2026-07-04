# Task 188 Checkpoint - MemberSidebar Presence Dots

## Completed

- MemberSidebar rows already receive live presence state from Task 187.
- Presence dots now expose a status label/title for better desktop accessibility.
- Status dots have a subtle token-based halo for clearer online/idle/DND/offline states.
- No layout structure changed; the 280px member sidebar remains fixed.

## Manual verification

1. Run Picom in Supabase mode with two clients in the same community.
2. Confirm online users show green presence dots in MemberSidebar.
3. Confirm offline users remain muted.
4. Hover a dot and confirm the status title is available.
5. Switch themes and confirm dots remain readable in light and dark mode.

## Notes

- This task does not persist status to the database.
- Presence remains a live Supabase Presence overlay.