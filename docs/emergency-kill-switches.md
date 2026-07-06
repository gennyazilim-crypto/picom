# Emergency Kill Switch Foundation

Picom emergency kill switches allow operators to temporarily disable risky or degraded capabilities without removing code or shipping a new desktop build.

Kill switches are availability controls. They are not a security boundary. Supabase RLS, role checks, storage policies, and LiveKit token authorization must continue to enforce access.

## Status

- Runtime service: `src/services/emergencyKillSwitchService.ts`
- Remote config integration: `killSwitches` allowlist in `src/services/remoteConfigService.ts`
- External provider: none
- Secrets: prohibited
- UI redesign: none
- Production auto-update: not enabled by this task

## Typed keys

The current emergency kill switch keys are:

- `disableRealtime`
- `disableUploads`
- `disableVoiceRooms`
- `disableDiscovery`
- `disableWebhooks`
- `disableBots`
- `disableNativeNotifications`
- `disableAutoUpdate`
- `disableMessageEditing`
- `disableInvites`

All default to `false`.

## Environment override

Renderer-safe local overrides can be provided with:

```env
VITE_EMERGENCY_KILL_SWITCHES=disableRealtime=true,disableUploads=false
```

JSON is also supported for local/development use:

```env
VITE_EMERGENCY_KILL_SWITCHES={"disableRealtime":true,"disableVoiceRooms":false}
```

Never place secrets in `VITE_EMERGENCY_KILL_SWITCHES`. Vite variables are public renderer configuration.

## Remote config shape

Remote config may include:

```ts
{
  killSwitches: {
    disableRealtime: true,
    disableUploads: false
  }
}
```

The renderer accepts only known typed keys with boolean-like values. Unknown keys and malformed values are ignored with redacted warnings.

## Relationship to feature flags

Feature flags answer:

- Is this feature available in this build or channel?

Kill switches answer:

- Is this feature temporarily disabled because of an incident or rollout risk?

UI entry points for kill-switchable features should prefer:

```ts
emergencyKillSwitchService.shouldShowEntryPoint("enableRealtime")
```

or:

```ts
emergencyKillSwitchService.getFeatureAvailability("enableRealtime")
```

This combines the feature flag state with any active emergency kill switch.

## Fail-safe behavior

- Defaults keep MVP flows usable.
- Remote config failure falls back to cached/default config.
- Kill switches can only disable or hide risky functionality.
- Disabled features should show clear temporary-unavailable copy if deep-linked.
- Backend and Supabase policies must still reject unauthorized access.
- Active kill switches should be documented in incident notes and release status.

## Operator workflow placeholder

1. Confirm the user impact and affected feature.
2. Activate the narrowest possible kill switch through remote config or future operations tooling.
3. Confirm desktop clients receive the updated public config.
4. Verify the UI hides or blocks the disabled feature safely.
5. Keep core chat MVP paths available when possible.
6. Communicate the known issue to beta/stable users if user impact is visible.
7. Deactivate the kill switch only after the fix is verified.

## Test steps

Run:

```bash
npm run emergency:kill-switches:smoke
npm run remote-config:smoke
npm run typecheck
npm run build
```

Manual checks:

1. Apply local `VITE_EMERGENCY_KILL_SWITCHES=disableRealtime=true`.
2. Confirm `emergencyKillSwitchService.getFeatureAvailability("enableRealtime")` reports disabled.
3. Confirm unknown kill switch keys are ignored.
4. Confirm no secrets are present in remote config or env examples.
