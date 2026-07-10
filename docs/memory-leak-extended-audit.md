# Extended Memory Leak Audit

## Status

Source lifecycle remediation and structural regression checks are complete. Packaged long-run **heap snapshots pending** on Windows, Linux and macOS; this document does not claim measured zero-growth behavior without that evidence.

## Findings

| Area | Finding | Result |
| --- | --- | --- |
| Object URLs | Composer previews revoke removed, overflowed, sent and unmounted file URLs; export URLs are revoked after use | Pass |
| Realtime messages | Channel/community changes invalidate generation, mark callbacks canceled and remove the Supabase channel | Pass |
| Realtime typing | Interval, typing state and channel are cleared; offline/online listeners are removed | Pass |
| Realtime presence | Pending timer, heartbeat, browser listeners, presence state, untrack and channel removal are covered | Pass |
| Direct messages | Both message/reaction channels and dedupe maps are removed on conversation/view change | Pass |
| LiveKit room | Leave/failure paths stop tracks, remove listeners and disconnect | Pass |
| Unexpected LiveKit disconnect | Local tracks and screen share were previously only dereferenced; now stopped, listeners removed and global room cleared | Fixed |
| Screen share | Unpublish/stop, publish failure, empty stream and source-ended paths release media tracks | Pass |
| Message highlight timers | Rapid jumps previously accumulated timeouts and unmount could retain one callback | Fixed |
| Voice devices | `devicechange` listener is installed once and removed after the final subscriber | Pass |
| Network/sleep-wake | Browser/native listeners, intervals and debounce timers have stop/cleanup paths | Pass |
| API requests | Timeout and external AbortSignal listener are removed on success/failure/retry | Pass |
| Keyboard listeners and pointer listeners | Core overlays, command palette, context menu, profile and dialog focus hook remove their listeners | Structural pass |

## Cleanup invariants

- Every `URL.createObjectURL` owner must expose or call a matching revoke path.
- Every Supabase channel subscription must be removed on view/scope change and stale callbacks must be ignored.
- Timers created by components must be cleared on dependency change/unmount; repeated actions replace the prior timer where only one result is meaningful.
- LiveKit final disconnect/leave must stop local audio/video/screen tracks, clear screen-share state, remove room listeners and release the room reference.
- Media device and global keyboard/network/visibility listeners must be reference-counted or removed in effect/service cleanup.
- Non-critical async callbacks use canceled/active guards before React state updates.

## Automated check

```powershell
npm run memory:leak:extended:audit
```

This structural test checks lifecycle markers. It is not a substitute for runtime heap/media/device observation.

## Packaged long-run procedure

1. Start a release-candidate build with synthetic mock/staging accounts.
2. Record baseline renderer/main process memory after five idle minutes.
3. Repeat at least 100 community/channel switches, message sends, context/profile/modal opens and closes.
4. Add/remove attachment previews repeatedly and confirm blob URL/memory settles after GC.
5. Reconnect realtime repeatedly and verify Supabase channel counts do not grow after scope changes.
6. Join/leave LiveKit rooms, mute/deafen, start/stop/cancel screen share and simulate network disconnect/reconnect.
7. Observe OS microphone/screen indicators after leave/disconnect; capture must be released.
8. Sleep/wake and move between Mention Feed/community/profile/settings views for at least two hours.
9. Capture comparable heap snapshots and process/media metrics after forced GC where the approved harness permits it.
10. File any retained-listener/channel/track/timer growth with reproduction, owner and threshold; include no private content or credentials.

## Release gate

No blocker/high unbounded growth, retained private attachment blob, duplicate realtime channel, active capture after leave, or duplicate global listener may remain. Platform-specific baseline variance must be documented rather than hidden by an arbitrary threshold.
