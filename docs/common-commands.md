# Picom Common Commands

Run commands from the repository root.

## Setup and development

| Command | Purpose |
| --- | --- |
| `npm ci` | Reproduce lockfile dependencies |
| `npm run dev` | Build Electron and start/open Electron + Vite dev app |
| `npm run renderer:dev` | Renderer-only Vite development |
| `npm run preview` | Preview built renderer only |

## Main quality gates

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Renderer TypeScript check |
| `npm run electron:build` | Compile Electron TypeScript |
| `npm run mock:smoke` | Deterministic mock data/service paths |
| `npm run qa:smoke` | Main desktop/security/diagnostics/package/media smoke gate |
| `npm run quality:fast` | QA smoke + typecheck |
| `npm run quality:gate` | QA smoke + typecheck + production build |
| `npm run build` | Typecheck + Electron build + Vite production build |

## Environment and secrets

| Command | Purpose |
| --- | --- |
| `npm run env:placeholders:check` | Validate committed env examples/placeholders/ignore rules |
| `npm run env:smoke` | Validate renderer-safe env names/defaults |
| `npm run secrets:smoke` | Runtime secret exposure scan |
| `npm run secrets:ci:smoke` | Secret scanning CI/documentation placeholder check |

## Supabase

| Command | Purpose |
| --- | --- |
| `npm run qa:supabase` | Static schema/RLS/API mode regression gate |
| `npm run supabase:smoke` | Migration/schema asset structural check |
| `npm run supabase:rls:smoke` | RLS pgTAP-shape/scenario static check |
| `npm run supabase:rls:production-safe` | Non-connecting production preflight/evidence check |
| `npm run supabase:rls:test` | Real local pgTAP; requires Supabase CLI/local DB |
| `npm run supabase:status` | Supabase CLI local status |
| `npm run supabase:db:push` | Apply linked migrations; approval/target check required |
| `npm run supabase:functions:deploy` | Deploy LiveKit token function; approval/secrets required |

Do not run remote mutation commands casually or against production without backup/approval.

## LiveKit and Realtime

| Command | Purpose |
| --- | --- |
| `npm run livekit:smoke` | Static renderer/function/IPC/voice/share contract |
| `npm run realtime:ordering:smoke` | Event ordering/duplicate guard smoke |
| `npm run realtime:backpressure:smoke` | Typing/presence backpressure smoke |
| `npm run realtime:load:simulate` | In-memory development-only simulation |

## Packaging

| Command | Purpose |
| --- | --- |
| `npm run packaging:smoke` / `package:verify` | Validate configuration/assets/security without package |
| `npm run package:win:dir` | Windows unpacked x64 directory |
| `npm run package:win` | Windows NSIS x64 installer |
| `npm run package:linux:appimage` | Linux x64 AppImage on Linux host |
| `npm run package:linux:deb` | Linux x64 deb on Linux host |
| `npm run package:mac:dmg` | macOS x64 dmg on macOS host |
| `npm run package:mac:zip` | macOS x64 zip on macOS host |
| `npm run release:checksums:smoke` | Verify checksum generation path |
| `npm run release:provenance:smoke` | Verify provenance generation path |

`release/` is ignored; never commit artifacts or signing credentials.

## Operations/safety

| Command | Purpose |
| --- | --- |
| `npm run backup:verify:smoke` | Non-destructive backup workflow placeholder smoke |
| `npm run database:restore-drill:smoke` | Restore drill documentation smoke |
| `npm run rollback:smoke` | Rollback runbook smoke |
| `npm run incident:response:smoke` | Incident runbook smoke |
| `npm run logs:smoke` / `diagnostics:smoke` | Redaction and diagnostic safety |

Review the related document before any maintenance script. Destructive scripts require explicit environment/confirmation and verified non-production targets.
