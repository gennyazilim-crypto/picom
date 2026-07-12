# Meeting Diagnostics Privacy Contract

Status: Full MVP engineering contract. Public/legal wording remains subject to authorized review.

## Allowed diagnostic fields

- Random request/correlation identifiers.
- Picom app version, platform, architecture, and release channel.
- Room/session identifiers only where authorized support access requires them.
- Meeting phase, reconnect count, provider error category, track source, permission outcome category, and aggregate participant count.
- Device kind and selected/not-selected state without exposing persistent hardware identifiers where avoidable.
- Caption lifecycle status and provider error category without transcript text.
- Timestamp, duration, and safe feature-state booleans.

## Forbidden diagnostic content

- Microphone, camera, or screen-share content.
- Audio/video frame payloads or recording files.
- Caption/transcript text.
- Meeting chat body or attachment content.
- Waiting-room request messages.
- Provider identity strings unless irreversibly minimized for an authorized operational need.
- Supabase keys, LiveKit keys/secrets/tokens, caption-provider keys, auth tokens, cookies, passwords, or connection strings.

## Redaction and export

Diagnostic export must use the centralized redaction path, default to local user action, and describe what is included before export. Support operators must request the minimum evidence required and must not ask users to paste secrets or raw `.env` files.

## Audit versus diagnostics

Restricted audit evidence records who performed a safe security-relevant action and its bounded target. Diagnostics explain technical state. Neither channel may contain raw media or transcript/chat content. Audit events are append-only; diagnostic logs follow the application's shorter operational log policy.
