# Task 568 checkpoint: meeting history, attendance, and recent sessions

## Result

Extended the existing webhook-authoritative meeting schema instead of creating a parallel attendance system. Community members now receive permission-safe recent/upcoming session summaries; managers with `viewMeetingHistory` receive safe attendance, while ordinary users receive only their own attendance.

## Security and privacy

- Verified `room_finished` meeting events project duration and outcome provenance.
- History RPCs are authenticated, membership/own-history bounded, result-limited, and security-definer functions with explicit checks.
- Attendance never returns provider identity hashes.
- Durable chat opens through `get_meeting_chat_context` and existing deep-link handling, preserving channel/RLS checks.
- Captions remain ephemeral and recording/transcript availability is always false.
- No raw media, provider token, private webhook payload, or recording claim was introduced.

## Product integration

- Community Admin Events includes meeting history and permission-aware attendance.
- Meeting Info includes compact current-user recent participation.
- Upcoming/live sessions deep-link through the meeting route.
- Ended sessions deep-link only to accessible durable chat.
- Profile activity integration remains deferred until its existing privacy RPC can enforce equivalent meeting visibility.

## Validation

- Task 568 structural smoke: PASS.
- Existing LiveKit webhook security smoke: PASS.
- Existing meeting RLS/permission smoke: PASS after correcting its stale exact-plan assertion to accept the expanded 36-test pgTAP contract without lowering the 28-test floor.
- `npm run typecheck`, `npm run mock:smoke`, `npm run supabase:smoke`, `npm run build`, and `npm run qa:smoke`: PASS in a clean detached worktree.
- `npm run performance:budget:ci`: PASS (`initialJs` 1187.0 KiB, `initialCss` 235.1 KiB, total assets 3387.0 KiB; warning targets remain below hard caps).
- The isolated build used a tiny fixture for the existing Cursor-owned untracked logo path; that unrelated asset was not modified or staged.
- Local Supabase CLI was unavailable, so pgTAP execution itself remains BLOCKED rather than inferred from structural smoke.
- Signed hosted webhook replay and role-matrix RLS evidence: BLOCKED until protected Supabase/LiveKit staging is available.
