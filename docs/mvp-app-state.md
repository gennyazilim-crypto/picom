# MVP active community/channel state

Task 068 creates a focused MVP navigation state hook.

## Runtime source

- `src/state/useMvpAppState.ts`

## Responsibilities

- Own `activeCommunityId`.
- Own `activeChannelId`.
- Derive active community, channels, and active channel.
- Switch community and select its first text channel.
- Move channel selection up/down for keyboard shortcuts.

## Guardrails

- This is local client state only.
- It does not introduce a global store dependency.
- It keeps mock mode backend-free.
- It does not add advanced roadmap features.