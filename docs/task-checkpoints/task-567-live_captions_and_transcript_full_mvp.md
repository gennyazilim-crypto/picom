# Task 567 checkpoint: live captions and transcript Full MVP

## Result

Implemented an opt-in, room-wide caption architecture using a server-side LiveKit Agent and Deepgram Nova-3. Caption text is delivered through `lk.transcription`, bounded to renderer memory, and never persisted in Full MVP.

## Security and consent

- Host/cohost start is protected by `enable_captions` authorization.
- Every active participant must accept policy `2026-07-11` before dispatch.
- New participants cannot publish microphone audio during active captions until they accept and refresh authorization.
- Consent withdrawal stops the provider session.
- Dispatch preparation is `service_role` only.
- Provider keys, LiveKit admin credentials, dispatch IDs, and callback secrets never reach React.
- Agent callbacks use a dedicated secret and contain lifecycle metadata only.
- Mock mode reports captions unavailable and never emits simulated transcript text.

## UI

- Captions tab with language selection, consent decisions, provider/lifecycle state, text size, overlay visibility, transcript panel, and host stop control.
- Room-wide top-bar indicator for consent/start/live states.
- In-stage caption overlay with small/medium/large text options.
- Provider failure and unavailable states are explicit.

## Persistence decision

Transcript and audio retention are intentionally excluded. The database stores only consent, status, language, policy version, timestamps, and private dispatch metadata. There is no transcript export.

## Validation

- Task 567 structural smoke: PASS.
- `npm run typecheck`: PASS.
- `npm run mock:smoke`: PASS.
- `npm run supabase:smoke`: PASS with the expected local Supabase CLI unavailable notice.
- `npm run build`: PASS.
- `npm run performance:budget:ci`: PASS (`initialJs` 1186.9 KiB, `initialCss` 235.1 KiB, total assets 3371.3 KiB; warning targets remain below hard caps).
- `npm run qa:smoke`: PASS.
- Validation used a clean detached worktree. The existing `RegisterScreen` import points to a Cursor-owned untracked logo, so the isolated build supplied a tiny path fixture rather than staging or altering that unrelated asset.
- Supabase pgTAP, real Deepgram transcription, LiveKit dispatch, latency/cost, and legal-provider approval: BLOCKED until protected hosted staging infrastructure is available.

## Files

The task is isolated to meeting caption types/services/components, LiveKit text-stream integration, consent-aware meeting tokens, caption SQL/RLS/tests, Edge Functions, server agent, operations/privacy docs, and this checkpoint.
