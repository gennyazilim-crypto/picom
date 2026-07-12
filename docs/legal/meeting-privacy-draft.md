# Meeting Privacy Notice Draft

**DRAFT - NOT LEGALLY APPROVED**

This is a technical disclosure draft, not a published privacy notice.

## Data processed during a meeting

- Picom account/profile identity and meeting role.
- Room, invite, waiting-room, admission, moderation, and lifecycle metadata.
- Real-time microphone, camera, and screen media when explicitly activated.
- Meeting chat content under the normal messaging policy.
- Optional caption audio processing and ephemeral transcript segments after unanimous room consent.
- Attendance and restricted security/audit events.

## Data not persisted by the Full MVP

Picom does not persist raw meeting audio, raw meeting video, raw screen-share media, or caption transcript text through a recording/transcript feature. LiveKit and configured caption infrastructure still process active media for transport or transcription. No end-to-end encryption claim is made.

## Waiting room and guests

Waiting-room details are visible only to authorized hosts/cohosts. Those details can include the submitted display name, requested role, invite state, and optional request message. A waiting user cannot access room media, participants, chat, or captions before admission. Unmapped provider participants are represented with a generic guest label in history views.

## Retention draft

Technical minimum markers are 365 days for attendance, 730 days for safe meeting events and audit evidence, and 90 days for waiting-room metadata. Durable chat follows the messaging retention policy. These periods require authorized legal approval; automatic purge is disabled until legal-hold and deletion controls are approved.

## Access and disclosure

Meeting data is restricted by community permissions, RLS, server-authorized functions, and provider access controls. Picom may use LiveKit and a configured caption provider to deliver requested functionality. Provider, regional transfer, subprocessors, lawful-basis, data-subject rights, and contact disclosures remain legal-review blockers.

## Diagnostics

Diagnostics may contain safe aggregate lifecycle and device-state categories. They must not contain media content, transcript text, chat bodies, waiting request messages, provider credentials, or authentication tokens.
