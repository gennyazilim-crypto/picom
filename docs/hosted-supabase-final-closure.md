# Hosted Supabase Final Closure

Status date: 2026-07-11  
Final Task 421 status: **PARTIAL / BLOCKED**

## Evidence reviewed

- Prior real staging migration parity through `20260710258000`.
- Prior hosted Auth/profile-trigger and synthetic login/session evidence.
- Prior owner/admin/moderator/member/visitor RLS evidence.
- Prior private Storage denial/authorized-access evidence.
- Task 419 private Realtime Presence review.
- Task 420 Edge Function inventory and security contract review.

## Fresh local rerun

| Gate | Result |
| --- | --- |
| Hosted RLS preflight | PASS, configuration-only; no network request |
| Hosted Realtime preflight | PASS, configuration-only; no network request |
| Hosted Edge preflight | PASS, configuration-only; no network request |
| Supabase QA gate | PASS |
| Structural RLS contract | PASS; real pgTAP skipped without CLI |
| Supabase API regression | PASS |
| Secret exposure scan | PASS |
| Typecheck | PASS |
| Production build | PASS |
| Full QA smoke | PASS |

## Hosted release matrix

| Area | Status | Basis |
| --- | --- | --- |
| Migration parity | Prior PASS | Real staging evidence through committed migration `20260710258000` |
| Auth/profile trigger | Prior PASS | Synthetic hosted accounts |
| Core role RLS | Prior PASS | Public/private role matrix |
| Private Storage | Prior PASS with remaining lifecycle gaps | Object boundary proven; historical refresh/restore incomplete |
| Mention Feed/Profile/DM lost-access | BLOCKED | Full hosted matrix not rerun |
| Private Realtime Presence | FAIL/BLOCKED | Earlier `Unauthorized` result remains; Task 419 had no protected rerun context |
| Realtime reconnect/ghost cleanup | BLOCKED | Local contract only |
| Release-scoped Edge Functions | BLOCKED | `livekit-token` not deployed or invoked in Task 420 |
| Secret hygiene | PASS locally | No secret in renderer/repository scan; hosted custody still unresolved |

## Decision

Hosted Supabase cannot be marked PASS. A PASS requires Auth, RLS, Storage, Realtime, and release-scoped Edge Functions all to be proven against the approved staging project. The current truthful result is **PARTIAL / BLOCKED**.

No policy was broadened, no credential was committed, and no missing hosted result was converted into a local PASS. RB-01, RB-02, and RB-03 remain open. Stable release remains No-Go.

