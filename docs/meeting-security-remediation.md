# Meeting Security Remediation Register

## Open release blockers

| ID | Severity | Gap | Required closure evidence |
| --- | --- | --- | --- |
| SEC-MTG-001 | P0 | Hosted private meeting RLS matrix is incomplete | Owner/admin/moderator/member/visitor/guest/blocked/non-participant requests prove room, participant, invite, attendance, chat, caption, moderation, and token allow/deny outcomes in approved staging. |
| SEC-MTG-002 | P0 | Deployed meeting token/webhook boundaries are unproven | Real meeting-token TTL/identity/grants/waiting/blocked/CORS/body-limit tests and webhook valid/tampered/expired/replay tests pass with redacted references. |
| SEC-MTG-003 | P0 | Private Realtime and durable meeting data isolation are unproven | Authorized delivery and unauthorized silence are observed for participants, chat, reactions, hand state, notifications, history, audit, and captions without payload logging. |
| SEC-MTG-004 | P0 | Native consent/media indicators are not certified | Windows, Linux, and macOS exact candidates prove deny/grant/restart, visible mic/camera/share/caption state, remote render, stop, reconnect, leave/end, and no ghost capture. |
| SEC-MTG-005 | P1 | Independent adversarial review is absent | Approved reviewer repeats IPC, RLS, token, webhook, guest, blocked, rate-limit, diagnostics, retention, and secret-custody attacks; every Critical/High is fixed and retested. |

## Incident rule

If testing finds unauthorized data/media access, hidden capture, raw-media persistence, secret exposure, cross-room subscription, replay acceptance, or unredacted diagnostics:

1. Stop certification and keep stable `NO_GO`.
2. Revoke test access and affected provider/session material without recording values.
3. Preserve redacted timestamps, request/result classes, commit/artifact hashes, and reason codes.
4. Activate the incident response and private-channel access leak procedures.
5. Fix backend/IPC enforcement, add a regression contract, rerun hosted and native matrices, and obtain security approval before reconsidering release.

Missing evidence is `BLOCKED`, not PASS. A local contract cannot close SEC-MTG-001 through SEC-MTG-004.
