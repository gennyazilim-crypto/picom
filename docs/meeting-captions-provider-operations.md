# Meeting captions provider operations

## Approved pipeline

Picom Full MVP uses Deepgram Nova-3 through a named server-side LiveKit Agent (`picom-captions`). The Electron renderer receives only LiveKit's `lk.transcription` text stream. It never receives Deepgram credentials and never connects directly to the STT provider.

Components:

1. `meeting-captions` validates the authenticated user action, consent state, and meeting access.
2. A short-lived room-admin JWT dispatches `picom-captions` through LiveKit AgentDispatchService.
3. `services/captions-agent` subscribes to audio only and runs Deepgram STT without LLM or TTS.
4. The agent publishes interim/final transcription text through LiveKit and posts lifecycle-only callbacks.
5. `meeting-captions-agent` authenticates callbacks and updates lifecycle metadata without transcript text.

## Server-only configuration

Edge Function environment:

- `PICOM_CAPTIONS_ENABLED=true`
- `PICOM_CAPTIONS_PROVIDER=deepgram_livekit_agent`
- `PICOM_CAPTIONS_AGENT_NAME=picom-captions`
- `PICOM_CAPTIONS_AGENT_CALLBACK_SECRET`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `PICOM_ALLOWED_ORIGINS`

Agent environment:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `DEEPGRAM_API_KEY`
- `PICOM_CAPTIONS_AGENT_CALLBACK_URL`
- `PICOM_CAPTIONS_AGENT_CALLBACK_SECRET`

Rotate provider, LiveKit, callback, and service-role credentials independently. Never print them, include them in diagnostics, upload them as artifacts, or package them with Electron.

## Deployment and health

Apply `20260711161000_meeting_captions_transcript.sql`, deploy both Edge Functions, deploy the agent worker, and then enable the feature flag. Keep the feature disabled until a real dispatch can reach `active` and a stop can reach `stopped` in staging.

Monitor lifecycle counts, dispatch latency, provider errors, consent wait time, and estimated audio minutes. Do not record transcript text in telemetry. Suggested alert placeholders:

- dispatch-to-active p95 above 8 seconds
- provider failure rate above 2% over 15 minutes
- sessions stuck in `starting` or `stopping` for more than 2 minutes
- abnormal caption request volume per user/community
- spend above the approved daily audio-minute budget

Rate-limit changes must preserve host workflows while preventing dispatch spam. Apply community abuse controls to repeated unauthorized requests. Provider outage behavior is fail-closed: the UI says unavailable/failed and does not fabricate captions.

## Incident stop procedure

1. Set `PICOM_CAPTIONS_ENABLED=false`.
2. Stop active named-agent dispatches through LiveKit.
3. Verify lifecycle rows reach `stopped` or `failed` without storing transcript text.
4. Rotate affected credentials if compromise is suspected.
5. Inform users if consent/privacy expectations were affected.
6. Re-enable only after staging consent, dispatch, text-stream, withdrawal, and cleanup tests pass.

## Validation limits

Local structural and renderer tests cannot certify Deepgram processing, LiveKit dispatch, hosted RLS, region selection, latency, cost, or legal approval. Those require protected staging credentials and real multi-participant evidence. Missing hosted evidence is **BLOCKED**, never PASS.
