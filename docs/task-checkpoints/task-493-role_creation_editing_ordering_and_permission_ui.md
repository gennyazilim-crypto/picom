# Task 493 Checkpoint: Role Creation Editing Ordering and Permission UI

## Completed

- Replaced the read-only Roles card grid with a mature desktop hierarchy/editor layout.
- Added create, rename, color token/custom color, optional approved icon, grouped permission toggles, duplicate, audited order swap, and confirmed delete.
- Disabled editing, delegation, reorder, and delete actions when the actor cannot manage the target role.
- Added mock/local persistence and Supabase RPC persistence behind one service boundary.
- Added server-side hierarchy, permission payload, delegation, system-role, in-use, row-lock, and audit safeguards.
- Propagated role updates through CommunitySidebar to the main community store without changing member/channel state.

## External evidence

Real hosted RPC/RLS execution is blocked until Supabase staging credentials and CLI are available. Static schema/service contracts and mock behavior do not claim hosted success.
