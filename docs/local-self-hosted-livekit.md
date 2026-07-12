# Local Self-Hosted LiveKit

## Purpose

Picom Voice Rooms and Screen Share use a self-hosted LiveKit Server. This local workflow proves the provider path without a LiveKit Cloud subscription and without changing the V1 product scope. Voice and Screen Share remain visible V1 capabilities; unavailable infrastructure must produce a clear error rather than silently hiding them.

## Isolation, provider, and version

- Server version: `1.13.1`
- Windows/Linux default: official native LiveKit release archive, verified against the publisher's `checksums.txt` SHA-256 value before extraction
- macOS native mode: a Homebrew-installed `livekit-server` whose reported version is exactly `1.13.1`
- Optional Docker image: `livekit/livekit-server:1.13.1`
- Pinned Docker digest: `sha256:2c6869d2d5ff6c9c0166f47be1c92dad6928bfecfa5e4060a6ece48db8accfa3`
- Container: `picom-livekit-local`
- Default signal/API: `127.0.0.1:17880`
- Default WebRTC/TCP: `127.0.0.1:17881`
- Default WebRTC/UDP mux: `127.0.0.1:17882/udp`

The native provider is the default on Windows/Linux because it gives WebRTC a real host loopback interface and avoids Docker Desktop's loopback ICE/NAT limitation. The optional Docker provider remains available for explicit testing and Task 661's Redis topology. The non-default ports avoid the unrelated `piso-livekit` environment currently present on the development machine. Picom lifecycle commands address only the verified native PID or the exact `picom-livekit-local` container name and never stop arbitrary processes or containers.

## Prerequisites

1. Keep ports `17880`, `17881`, and `17882/udp` available.
2. Run commands from the Picom repository root.
3. Allow the first Windows/Linux start to download the official pinned release archive. Later starts use the ignored, SHA-verified cache.
4. On macOS, install and pin LiveKit `1.13.1` with Homebrew. Docker can be selected explicitly when needed.

## Loopback workflow

```powershell
npm run livekit:local:start
npm run livekit:local:health
npm run livekit:local:e2e
```

The default native provider can be selected explicitly with `npm run livekit:local:start -- --provider=native`. The Docker alternative is `npm run livekit:local:start -- --provider=docker`; Docker Desktop loopback health can work even when its WebRTC ICE path cannot, so Windows media certification uses the native provider.

For the Picom renderer, copy only the public values from `infra/livekit/local/renderer.env.example` into the ignored `.env.local`, then start Electron normally. The renderer never receives the API key or API secret. The production token path remains the authenticated Supabase `livekit-token` Edge Function.

The local E2E command opens two hidden, sandboxed Electron renderer clients. Both clients connect to the real local LiveKit Server, publish synthetic microphone audio and a synthetic screen track, subscribe/render the remote tracks, propagate mute/unmute, reconnect, leave, and release tracks. Synthetic media avoids recording a developer's real microphone or desktop.

## LAN workflow

LAN mode is opt-in and binds Docker's published ports to `0.0.0.0`. Supply the host's private LAN IPv4 explicitly when more than one adapter is present:

```powershell
npm run livekit:local:start:lan -- --lan-address=192.168.10.25
npm run livekit:local:health
```

Then set `VITE_LIVEKIT_URL` to the printed private `ws://` URL on each LAN test client. Never use LAN mode on an untrusted network. Windows Defender Firewall or the macOS firewall must permit only the selected private network for TCP `17880`, TCP `17881`, and UDP `17882`. Do not create a public router port-forward for this development stack.

## Secrets and production separation

Each start creates a fresh random API key and secret under `.tmp/picom-livekit-local`. That directory is Git-ignored, marked development-only, and removed by stop/cleanup. Secrets are read by the server from a private configuration file; they are not passed to the renderer, command line, package configuration, documentation, evidence, or Git. Downloaded native binaries are kept in an ignored cache only after archive SHA-256 verification.

These credentials are intentionally incompatible with staging/production operations:

- `environment` is `development`.
- `scope` is `PICOM_LOCAL_DEVELOPMENT_ONLY`.
- `doNotPromote` is `true`.
- The endpoint is restricted to loopback or private RFC1918 LAN space.
- Release artifacts do not include `.tmp`.

Staging and production require separate hosts, domains, TLS, Redis, TURN, secrets, monitoring, and certification in Tasks 660-676.

## Stop and cleanup

```powershell
npm run livekit:local:stop
npm run livekit:local:cleanup
```

Both commands stop only a native PID whose executable and command line still match the recorded Picom LiveKit runtime, or remove only `picom-livekit-local`. They delete generated credentials/configuration and wait for the Picom target ports to be released. `cleanup` also removes the generated Electron E2E renderer bundle.

## Troubleshooting

- `Docker is unavailable`: this matters only for explicit `--provider=docker`; use the default native provider for Windows/Linux.
- `macOS native mode requires Homebrew`: install/pin LiveKit `1.13.1`, or explicitly use Docker.
- `target port is already in use`: identify the process yourself or override the `PICOM_LIVEKIT_LOCAL_*_PORT` variables; Picom will not terminate unrelated software.
- `LAN address is ambiguous`: pass `--lan-address=<private IPv4>`.
- `HTTP health endpoint is unavailable`: run cleanup, confirm Docker health, and start again. Provider logs are deliberately not echoed by the wrapper because configuration files contain credentials.
- LAN clients connect but media does not: verify private-network firewall rules and that the advertised LAN address belongs to the Docker host.

No local workflow proves public internet/TURN, native packaged screen capture, Windows/macOS release certification, or production readiness. Those remain truthful later-task gates.
