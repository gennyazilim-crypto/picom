# Remote Config Foundation

Picom remote config is a public, non-secret configuration path for desktop clients. It can communicate version guidance, feature flag availability, upload limits, service status, and support URLs without requiring an app update.

## Status

- Renderer service: `src/services/remoteConfigService.ts`
- Supabase Edge Function placeholder: `supabase/functions/client-config/index.ts`
- Secrets: prohibited
- MVP fallback: safe local defaults and optional cached config
- UI changes: none in this task

## Public response shape

```ts
export type ClientRemoteConfig = {
  minimumSupportedVersion: string;
  recommendedClientVersion: string;
  latestVersion: string;
  releaseChannel: 'dev' | 'beta' | 'stable';
  featureFlags: Partial<Record<FeatureFlagKey, boolean>>;
  killSwitches: Partial<Record<EmergencyKillSwitchKey, boolean>>;
  maintenance: {
    status: 'operational' | 'degraded' | 'maintenance';
    message: string;
  };
  uploadLimits: {
    maxUploadBytes: number;
    allowedMimeTypes: string[];
  };
  urls: {
    statusPageUrl: string;
    supportUrl: string;
    docsUrl: string;
  };
};
```

## Renderer env variables

```env
VITE_APP_VERSION=0.1.0
VITE_REMOTE_CONFIG_URL=
```

`VITE_REMOTE_CONFIG_URL` is optional. If omitted in Supabase mode, the renderer derives:

```text
<SUPABASE_URL>/functions/v1/client-config
```

All `VITE_` values are bundled into the renderer and must be treated as public.

## Edge Function public env placeholders

The Edge Function may read public operational values such as:

- `PICOM_MINIMUM_SUPPORTED_VERSION`
- `PICOM_RECOMMENDED_CLIENT_VERSION`
- `PICOM_LATEST_VERSION`
- `PICOM_RELEASE_CHANNEL`
- `PICOM_MAX_UPLOAD_BYTES`
- `PICOM_MAINTENANCE_STATUS`
- `PICOM_MAINTENANCE_MESSAGE`
- `PICOM_STATUS_PAGE_URL`
- `PICOM_SUPPORT_URL`
- `PICOM_DOCS_URL`
- `PICOM_DISABLE_REALTIME`
- `PICOM_DISABLE_UPLOADS`
- `PICOM_DISABLE_VOICE_ROOMS`
- `PICOM_DISABLE_DISCOVERY`
- `PICOM_DISABLE_WEBHOOKS`
- `PICOM_DISABLE_BOTS`
- `PICOM_DISABLE_NATIVE_NOTIFICATIONS`
- `PICOM_DISABLE_AUTO_UPDATE`
- `PICOM_DISABLE_MESSAGE_EDITING`
- `PICOM_DISABLE_INVITES`

Do not put Supabase service role keys, LiveKit secrets, signing keys, passwords, auth tokens, or private admin config in remote config.

## Fail-safe behavior

If remote config is unavailable, the renderer service:

1. uses the last cached sanitized config if available
2. otherwise uses safe defaults
3. keeps MVP mock mode usable
4. logs a redacted warning only
5. never exposes raw error details to normal users

## Feature flags

Remote feature flags are passed through `featureFlagService.applyRemoteConfig()`, which accepts only known typed keys and boolean-like values. Feature flags hide or disable UI entry points only. Backend/Supabase RLS and LiveKit token authorization remain mandatory.

## Emergency kill switches

Remote kill switches are passed through `emergencyKillSwitchService.applyRemoteConfig()`, which accepts only known typed keys and boolean-like values. Kill switches can temporarily hide or block degraded features during incidents or rollout pauses. They must not be used as the only security boundary.

## Security rules

- Remote config must be public and non-sensitive.
- Unknown fields are ignored by the renderer service.
- Unknown feature flag keys are ignored.
- Unknown kill switch keys are ignored.
- Upload limits are clamped to safe bounds.
- Supabase anon key may be used to call the public Edge Function; service-role keys are never used in the renderer.

## Test steps

Run:

```bash
npm run remote-config:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

Manual checks:

1. Confirm `src/services/remoteConfigService.ts` falls back without a network call in mock mode.
2. Confirm `supabase/functions/client-config/index.ts` returns only public config fields.
3. Confirm `.env.example` documents `VITE_REMOTE_CONFIG_URL` as optional and public.
4. Confirm no UI entry point was added in this task.
