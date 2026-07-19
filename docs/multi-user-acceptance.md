# Multi-user acceptance matrix

Status: **Not executed in this pass**

| Scenario | User A | User B | Expected |
| --- | --- | --- | --- |
| Community message | send/edit/delete | observe | one ordered event, no duplicate |
| Community private channel | member | visitor/non-member | no metadata/content leak |
| DM message | send/retry | observe/read | one message by client ID; read cursor updates |
| DM typing/presence | type/connect/disconnect | observe | expires and reconnects without stale online state |
| DM block/removal | block/remove | attempt access | send/read/attachment denied |
| Feed reaction/comment | mutate | observe | counters reconcile once |
| Feed private source | permitted member | non-member | source absent from query/Realtime/cache |
| Community role change | owner changes role | affected member | UI refreshes; backend permission changes immediately |
| Voice/screen | join/share | join/view | membership enforced; media connects and cleans up |

Required environment: two independent staging users, two app windows or machines, hosted migrations, Realtime enabled tables, private Storage and working LiveKit/TURN. Record timestamps, user IDs in redacted form, expected/actual result and server logs for every row.
