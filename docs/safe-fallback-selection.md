# Task 072 - Safe fallback selection

Picom now guards the MVP app state against missing community or channel data.

## Runtime path

- `src/state/useMvpAppState.ts`

## Behavior

- If no communities are available, a typed fallback community is provided.
- If the active community id is missing, selection falls back to the first available community.
- If the active channel id is missing, selection falls back to the first text channel.
- Channel switching rejects unknown channel ids by selecting a safe fallback channel.

This prevents the desktop shell from crashing while future API mode or mock resets are being wired.

## Manual verification

1. Start the app with the normal mock data.
2. Switch communities and channels.
3. Confirm the active channel remains valid after community changes.
4. Future API tests can temporarily provide an empty community array and should still render the shell without a white screen.
