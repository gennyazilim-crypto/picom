# Meeting Privacy, Consent, and Retention

Status: Full MVP technical policy. Legal retention approval remains blocked pending authorized counsel review.

## Explicit media actions

Picom requests or publishes microphone, camera, and screen-capture media only after the user selects the corresponding control. Joining a meeting does not itself grant capture permission. Operating-system permission prompts remain authoritative, and a denied permission leaves that source off.

The meeting top bar exposes separate live indicators for microphone, camera, screen sharing, and captions. These indicators describe local/product state; they do not claim end-to-end encryption or bypass provider transport.

The Full MVP has no meeting recording feature. LiveKit and configured media/caption providers still process media required to deliver the session. This statement must be revisited before any recording feature is introduced.

## Captions consent

Captions are off by default and require an explicit room request plus affirmative consent from every active participant in the current consent round. A participant joining or declining after consent invalidates activation. The room-wide indicator is visible while consent is pending, captions are starting, or captions are active.

Caption transcript segments are ephemeral renderer memory. Picom does not persist transcript text in meeting events, audit logs, history rows, diagnostics, or database tables in this Full MVP. Provider processing occurs only when captions are configured and activated.

## Guest and waiting-room privacy

- Full MVP guests are authenticated Picom users admitted through the meeting access policy; anonymous provider identities are not displayed as product identity.
- Authorized hosts and cohosts may see a waiting user's submitted display name, requested role, invite state, and optional request message.
- Other participants cannot read waiting-room requests.
- Waiting users cannot see meeting participants, chat, captions, or room media before admission.
- Attendance history uses a generic guest label when a provider participant cannot be safely mapped to a Picom profile.

## Retention classes

| Data | Technical retention boundary | Deletion behavior |
| --- | --- | --- |
| Meeting attendance | 365-day minimum marker | No automatic purge until legal-hold and authorized retention rules are approved |
| Safe meeting lifecycle events | 730-day minimum marker | Append-only; normal application flows cannot update or delete |
| Restricted audit evidence | 730-day minimum marker | Append-only; normal application flows cannot update, delete, or truncate |
| Waiting-room metadata | 90-day minimum marker | No automatic purge until legal-hold and authorized retention rules are approved |
| Durable meeting chat | Inherits channel/message retention policy | Deleted or retained through the normal messaging policy |
| Caption transcript and raw caption audio | Ephemeral only | Not persisted by Picom Full MVP |
| Microphone, camera, screen media | Provider transport only | Not stored by a Picom recording feature in Full MVP |

`retention_until` is a minimum technical marker, not an authorization to delete. A future controlled purge must honor legal holds, audit requirements, community policy, and authorized approval.

## Audited actions

Restricted meeting audit coverage includes room create/update/archive/delete, start/end/lock/unlock, invite creation/revocation/acceptance, admit/deny transitions, role and host changes, participant mute/remove, screen-share policy and publication lifecycle, and caption request/start/activation/stop/failure.

Audit metadata is deliberately bounded. It must not contain chat bodies, waiting request text, transcript text, raw media, provider identity, credentials, or access/refresh/provider tokens.

## Access and limitations

Community audit access requires the existing audit permission. Attendance access returns all rows only to users with `viewMeetingHistory`; other participants can retrieve only their own attendance. Frontend checks are explanatory only; database functions, RLS, append-only triggers, and server-authorized webhook paths are the enforcement boundary.

## Approval blockers

- Authorized legal review of retention periods and deletion obligations.
- Legal-hold and controlled purge procedure.
- Provider data-processing and regional transfer review.
- Final public terms, privacy notice, and community guideline approval.
