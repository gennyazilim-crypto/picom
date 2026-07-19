# Picom self-hosted LiveKit

Picom uses the open-source LiveKit server on a dedicated Linux VM. LiveKit Cloud is not part of this deployment. Supabase remains the authentication and authorization boundary: the desktop client requests a short-lived room-scoped token from `livekit-token`; API keys and secrets remain server-side.

## Prerequisites

- Ubuntu or another supported Linux VM with a public IPv4 address.
- Docker Engine and Docker Compose v2.
- Two DNS records pointing to that VM, for example `voice.example.com` and `turn.example.com`.
- At least 4 vCPU, 8 GB RAM, and sufficient symmetric bandwidth for the expected rooms.
- An SSH user with Docker access or passwordless `sudo` for the deployment commands.

## Required firewall rules

- `80/TCP` for certificate issuance.
- `443/TCP` for HTTPS/WebSocket and TURN/TLS.
- `7881/TCP` for WebRTC TCP fallback.
- `3478/UDP` for TURN/UDP.
- `50000-60000/UDP` for WebRTC media.

Do not place the media UDP range behind a normal HTTP reverse proxy. Both Voice and TURN DNS records must resolve to the public server before Caddy requests certificates.

## Generate the official deployment

Run from the repository root:

```powershell
npm run livekit:self-hosted:generate
```

The command runs the official `livekit/generate` image and writes into `infra/livekit/generated`. Generated `livekit.yaml` contains API credentials and is gitignored. Treat the whole generated directory as a production secret; never commit, paste, or attach it.

## Deploy over SSH

Pass the generated domain directory explicitly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-self-hosted-livekit.ps1 `
  -Server YOUR_SERVER_IP `
  -SshUser YOUR_SSH_USER `
  -GeneratedConfigDirectory infra/livekit/generated/YOUR_DOMAIN `
  -UseSudo
```

The deploy script validates required files, uploads only the official generated Compose/Caddy/Redis/LiveKit configuration, runs `docker compose config`, pulls images, and starts the stack. It never prints file contents or credentials.

## Connect Supabase Edge Functions

Set these protected secrets in the production Supabase project without printing values in shared logs:

```text
LIVEKIT_URL=wss://VOICE_DOMAIN
LIVEKIT_API_KEY=<from generated livekit.yaml>
LIVEKIT_API_SECRET=<from generated livekit.yaml>
PICOM_LIVEKIT_DEPLOYMENT=self_hosted
PICOM_LIVEKIT_TURN_DOMAIN=TURN_DOMAIN
PICOM_LIVEKIT_REDIS_CONFIGURED=true
PICOM_ALLOWED_ORIGINS=<exact Picom origins>
```

Deploy `livekit-token`, `livekit-moderation`, `livekit-webhook`, and `admin-health`. The desktop production environment uses only the public URL:

```text
VITE_LIVEKIT_ENABLED=true
VITE_LIVEKIT_URL=wss://VOICE_DOMAIN
```

Never expose `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET` through `VITE_`, Electron preload, diagnostics, logs, screenshots, or release artifacts.

## Verify

```powershell
$env:LIVEKIT_URL="wss://VOICE_DOMAIN"
$env:PICOM_LIVEKIT_TURN_DOMAIN="TURN_DOMAIN"
npm run livekit:self-hosted:preflight
```

Then verify two authenticated Picom accounts on separate networks:

1. Join the same Voice channel.
2. Confirm bidirectional microphone audio.
3. Start and stop Screen Share and verify the remote track.
4. Repeat through a restrictive network to exercise TURN/TLS.
5. Open Settings > Admin Operations > System status and confirm `Self hosted`, `LiveKit operational`, `TURN configured`, and `Redis configured`.

UDP reachability and real media flow cannot be certified by a TCP-only script; the two-client and restrictive-network checks remain mandatory.
