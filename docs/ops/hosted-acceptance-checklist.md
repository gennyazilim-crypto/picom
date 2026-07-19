# Hosted Multi-User Acceptance Checklist (T99)

Run against the deployed build with **at least 2 real accounts on 2 machines** (this cannot be
executed from the code environment — it requires live human sign-ins). Record pass/fail + notes;
all items must pass before final readiness sign-off (T100).

## Accounts & auth
- [ ] Sign-up → verification email arrives → verify → sign-in (both accounts)
- [ ] Password reset end-to-end
- [ ] Steam/Epic sign-in (when operator completes provider setup)
- [ ] Session revoke ("revoke all sessions") kicks the other device

## Community core
- [ ] Create community (A) → B discovers and joins
- [ ] Channel message A→B delivered realtime; reactions; mentions notify
- [ ] Roles/permissions: B (member) cannot access admin surfaces; staff actions audited
- [ ] Report → appears in moderation queue; ban/mute enforced on B

## DM & voice
- [ ] DM A↔B realtime both directions
- [ ] Voice call invite → ring → accept → two-way audio; join/leave chimes (beta build with LiveKit)
- [ ] DND suppresses non-critical notifications; mentions/calls still ring per policy

## Privacy & intelligence (deployed this program)
- [ ] Analytics consent OFF by default; events recorded only after opt-in (check `analytics_events`)
- [ ] `realtime_counters` move while both users are active
- [ ] Delete account B → `deletion_propagation_status(B)` returns 0 residual on all surfaces
- [ ] Data export request completes (DSAR path)

## Ops
- [ ] `run_analytics_data_quality()` all ok/warn-explainable; `check_slos()` no breach
- [ ] Crash report + desktop update event recorded from a packaged Windows build

Sign-off: __________________  Date: __________
