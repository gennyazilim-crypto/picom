# LiveKit meeting token security

Task 535 adds a separate meeting token path while preserving the existing voice-channel token endpoint.

## Provider and SDK boundary

- Renderer dependency inspected: `livekit-client@2.20.0`.
- The Edge runtime does not bundle `livekit-server-sdk`; Picom's existing Web Crypto HMAC-SHA256 JWT helper is reused and now recognizes the LiveKit `camera` source.
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are read only inside `meeting-token`. They are absent from renderer services, responses, diagnostics, and logs.

## Authorization flow

1. Supabase verifies the JWT and binds the request to `auth.uid()`.
2. `authorize_livekit_meeting_token` validates room/session state, capacity, bans, timeouts, blocks, join policy, redemption, role, waiting/admission state, room capabilities, and scoped community permissions.
3. The provider room name is canonical: `meeting:{roomId}:session:{sessionId}`. The renderer cannot supply a room name or participant identity.
4. Waiting users receive a `202` waiting projection without a token. Denied users receive no provider metadata.
5. Authorized requests receive a five-minute JWT containing only the requested and approved microphone, camera, screen-share, data, and subscribe grants.

Stage viewers normally request subscribe/data only. Speakers, cohosts, and hosts receive publish grants only when the room capability and permission matrix allow them. A forbidden requested source fails the whole request rather than silently escalating or issuing a misleading token.

## Validation

- `scripts/livekit-meeting-token-security-smoke.mjs` checks JWT, CORS, body bounds, server-side RPC, canonical identity/room, waiting behavior, grant sources, short TTL, manifest, and secret boundary.
- `scripts/livekit-meeting-token-staging-validation.mjs --run` checks allowed, waiting, blocked, and missing-JWT fixtures without printing tokens or credentials.
- `supabase/tests/livekit_meeting_token_authorization.sql` checks function grants after migrations are applied to a disposable database.

Provider and hosted checks remain BLOCKED unless explicit staging-only configuration and LiveKit secrets are supplied.
