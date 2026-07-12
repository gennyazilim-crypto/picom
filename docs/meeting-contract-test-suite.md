# Meeting deterministic contract test suite

## Purpose

`node scripts/meeting-contract-suite.mjs` is the local, cross-platform gate for Picom's meeting backend contracts, services, state transitions, permissions, layouts, media lifecycle, controls, and renderer/native boundaries. It composes the existing focused tests instead of duplicating them or introducing a second framework.

The runner uses `process.execPath` and absolute paths, so it does not depend on PowerShell, Bash, path separators, or executable file bits. Every child receives explicit mock data-source settings. Service-role, LiveKit, signing, and access-token environment variables are removed before execution.

## Coverage map

| Group | Meaningful coverage |
| --- | --- |
| Domain/schema | Canonical domain, safe serialization boundaries, migrations, generated RPC/table contract, room administration |
| Permissions/security | Role/permission matrix, RLS/pgTAP contract, token body/JWT/source validation, webhook signature/body hash/idempotency, abuse limits, privacy consent/audit |
| Join/waiting/invites/notifications | Hash-only invites, join policy, waiting transitions, host decisions, Realtime lifecycle, idempotent reminders and deep links |
| State/Realtime/moderation | Store transition graph, stale generation guards, participant normalization, webhook/realtime ordering, reactions/hand signals, host controls, attendance |
| Media/device/screen share/IPC | Prejoin, device recovery, adaptive subscriptions, screen-share lease/publish/focus, sender/session validation, executable invalid-payload fuzzing, reconnect cleanup, runtime budgets |
| Layouts/controls/workspace | Workspace shell, voice lounge, speaker/grid/stage layouts, pin/focus, control dock, right dock |
| Chat/captions/accessibility/observability | Durable meeting chat, captions consent/lifecycle, keyboard/focus/reduced motion, redacted diagnostics, Noise Shield |

The Electron IPC fuzz test transpiles the actual validators and rejects malformed list/select/cancel screen-capture payloads, unknown keys, unsafe source IDs, invalid UUID-like request IDs, and 1,000 deterministic fuzz strings. Main-process sender/session/TTL guards remain separately asserted by the picker bridge contract.

## Out-of-scope safety

The suite preserves the control-dock assertion that recording, AI notes, and breakout controls remain absent. It does not execute staging, hosted, native, packaging, signing, notarization, load, or release scripts. Provider mocks prove deterministic behavior only and are never labeled hosted evidence.

## Failure behavior

All contracts run so the summary identifies every failing area, but any failed, timed-out, or crashed child makes the suite exit nonzero. There is no `continue-on-error`, fallback pass, or skipped required contract. Each child has a 30-second ceiling and bounded output buffer.

## Commands

```powershell
npm ci
node scripts/meeting-contract-suite.mjs
npm run typecheck
npm run mock:smoke
npm run build
npm run qa:smoke
```

The project already has many focused package commands. The canonical aggregate command is the Node runner above; package metadata is not duplicated while concurrent package work is present. A future clean package-only change may expose it as `meeting:contracts:test` with the exact same command.

## RLS evidence

Local structural tests validate migrations, grants, RLS policies, generated types, pgTAP plans, and hosted role fixtures. Executing pgTAP against hosted Supabase remains a protected Task 577 evidence requirement and is `BLOCKED` when the CLI/environment is unavailable.
