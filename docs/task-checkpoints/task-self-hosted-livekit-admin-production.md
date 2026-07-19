# Self-hosted LiveKit and admin production checkpoint

## Scope

- Keep Supabase Auth/RLS as the token authorization boundary.
- Replace LiveKit Cloud assumptions with an official self-hosted VM deployment path.
- Add secret-safe generation, SSH deployment, and network preflight tools.
- Add an app-admin-only infrastructure health probe and dashboard card.
- Keep platform Admin Operations hidden from normal users while reachable by `app_admins`.

## Security boundaries

- LiveKit API key/secret stay in generated config and Supabase Edge secrets.
- `admin-health` requires authenticated `is_app_admin()` access.
- Health responses contain no host, token, room, participant, IP, or content data.
- Generated infrastructure is gitignored.
- Existing community/DM room authorization remains unchanged.

## Deployment status

Repository preparation is complete when local tests pass. Server deployment still requires the approved SSH host/user, Voice and TURN DNS names, and permission to configure the production Supabase Edge secrets.

## Required live evidence

- DNS and trusted TLS.
- TCP 443 and 7881 reachability.
- UDP 3478 and 50000-60000 firewall verification.
- Two-client bidirectional audio.
- Remote Screen Share.
- TURN/TLS fallback from a restrictive network.
- Admin Operations protected infrastructure status.
