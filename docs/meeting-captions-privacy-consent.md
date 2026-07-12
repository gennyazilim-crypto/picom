# Meeting captions privacy and consent

## Full MVP policy

Picom live captions are **off by default** and use a server-side LiveKit Agent with Deepgram Nova-3. A host or authorized cohost must request captions and accept policy version `2026-07-11`. Every active participant must then explicitly accept before the agent is dispatched.

The room header shows a room-wide pending or live indicator. Participants joining after captions start receive a meeting token that cannot publish microphone audio until they accept and refresh meeting authorization. Withdrawing consent stops the room-wide caption session; Picom does not silently continue transcription.

## Data handling

- Full MVP retention is strictly `ephemeral`.
- Picom does not persist transcript text in Postgres, Storage, logs, analytics, crash reports, or audit metadata.
- Picom does not record or persist raw meeting audio for captions.
- The renderer keeps at most 200 current-room segments in memory and clears them when the meeting context closes.
- There is no transcript export or replay feature in Full MVP.
- Provider dispatch identifiers are service-role-only and never returned to the renderer.
- Provider and LiveKit secrets remain server-side; no secret uses a `VITE_*` variable.

Deepgram processes audio while captions are active. Product/legal owners must approve the provider terms, data processing region, subprocessors, privacy notice, and supported jurisdictions before enabling `PICOM_CAPTIONS_ENABLED=true` in a hosted environment.

## Consent states

`awaiting_consent` means the provider has not started. `starting` means every current active participant accepted and the Edge Function requested a named agent dispatch. `active` means the agent callback confirmed service. `stopping`, `stopped`, and `failed` are shown truthfully; none are represented as successful transcription.

Declined participants are never counted as accepted. Participants without a user identity block dispatch. A host cannot bypass participant consent through the renderer, and `prepare_meeting_caption_dispatch` is executable only by `service_role`.

## Access and abuse controls

- Caption state is visible only to users who can access the meeting session.
- Caption requests require the existing `enable_captions` meeting permission.
- Consent requires an active meeting participant record.
- Existing per-user action-rate limits cover caption writes and consent decisions.
- Input languages are allowlisted and request bodies are size/key validated.
- Transcript payloads are rendered as React text, never unsafe HTML.

Future persistent transcripts require a separate privacy review, retention/deletion policy, export/access model, RLS design, encryption assessment, and explicit product approval. They are not implied by this foundation.
