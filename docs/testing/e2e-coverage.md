# End-to-end coverage expansion

## Current truth

Picom does not yet have Playwright or another real browser/Electron UI E2E runner. Existing npm smoke scripts validate source/service contracts but do not click through the rendered app. They must not be reported as full E2E success.

CI now runs `npm run e2e:coverage:contract`. It blocks removal of the required login/register, community join, message send, attachment upload, Mention Feed, Profile and Voice coverage plan; validates referenced preflight commands; and enforces explicit mock/staging separation with production disabled.

## Modes

### Mock UI E2E (future default CI)

- deterministic local mock data/session;
- no Supabase/LiveKit/provider network;
- fixed locale/timezone/viewport/reduced motion;
- disposable local settings/cache directory per test;
- safe generated attachment fixtures;
- runs on pull requests after build once the runner is stable.

### Staging UI E2E (future protected workflow)

- dedicated staging Supabase/Storage/Realtime/LiveKit resources and synthetic accounts;
- environment-scoped CI secrets, never repository/PR logs/artifacts;
- explicit `E2E_TARGET=staging` and protected workflow/environment approval;
- unique run prefix, cleanup and no production IDs/endpoints;
- scheduled/release candidate, not every untrusted fork;
- redacted traces/screenshots/videos retained under bounded policy.

No command may accept `production`, a production endpoint/project reference, or real user credentials. Staging automation remains planned until a protected environment exists.

## Required scenarios

### Login/register

- no-session login screen, invalid credentials, register/profile creation, verification state, logout and restore;
- mock and staging flows remain separate;
- never print password/session/token.

### Community join

- public join or invite, membership/sidebar update, private channels hidden before join;
- invalid/expired/revoked invite and duplicate join;
- leave/owner restriction where test data supports it.

### Message send

- optimistic pending to confirmed, clientMessageId reconciliation, rapid ordering, retry/failure/offline queue;
- two-client staging realtime insert/update/delete without duplicates;
- permission/slow-mode rejection remains recoverable.

### Attachment upload

- valid PNG/JPEG/WebP/GIF fixture, progress/preview/send/image modal;
- invalid MIME/oversize/failure/cancel/retry;
- staging private access and scan/quarantine state without raw paths/URLs in artifacts.

### Mention Feed

- Feed/Following tabs, stories, filters, footer reactions/save/read and open-in-channel;
- blocked/private content absent;
- deterministic mock authors/media.

### Full Profile

- open from message/member/feed, back navigation, follow state, privacy projection, shared-media preview and open-in-channel;
- inaccessible private activity absent.

### Voice smoke

- mock room state/controls/device errors/leave and screen-source placeholder;
- protected staging join/token, two clients, mute/deafen/reconnect/leave and optional screen share certification;
- no recording or token output.

## Future commands

After runner approval, add commands with clear semantics:

```text
npm run e2e:mock
npm run e2e:staging -- --confirm-staging
npm run e2e:electron:smoke
```

Do not create aliases that silently target staging or production. Existing `npm run staging:smoke:placeholder` remains non-destructive and manual.

## Runner activation

1. Pin and review Playwright dependency/licenses/browsers.
2. Add stable test navigation/hooks without redesigning UI.
3. Implement mock mode first and prove repeatability on Windows/Ubuntu.
4. Add minimal Electron window/chrome test separately.
5. Provision protected staging and synthetic lifecycle/cleanup.
6. Tune timeouts/retries/artifacts; quarantine flakes with owner/deadline.
7. Make mock blocking, then promote selected staging flows after repeated evidence.

## Failure/artifact policy

- Retry only known infrastructure flakes; app assertions do not auto-retry into success.
- Failed mock tests may upload redacted screenshot/trace.
- Staging artifacts require secret/private-data scan and bounded retention.
- Never auto-update visual baselines or expose test credentials.
- A private-channel leak, production-target attempt, startup crash, duplicate message, or session/token leak is a release blocker.
