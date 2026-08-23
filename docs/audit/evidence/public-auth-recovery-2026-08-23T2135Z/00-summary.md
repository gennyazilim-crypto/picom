# PICOM public infrastructure + auth recovery — evidence

Audit time: 2026-08-23T21:35Z
Workstation: Windows client. SSH alias `picom-update-server` (`root@23.254.166.240`).

Compared with 2026-08-16T18:50Z: the host ingress blackhole is gone. TCP 22/80/443 and HTTPS all answer from this workstation.

## Phase 1 host truth

```text
VPS_RUNNING: YES
hostname: hwsrv-1333695.hostwindsdns.com
uptime: 1 day, 7 hours (at 21:35Z)
EXPECTED_IP: 23.254.166.240
ACTUAL_IP: 23.254.166.240/24 on ens3 UP
IP_MATCH: YES
default via 23.254.166.1 dev ens3
PROVIDER: Hostwinds / HostPapa (PTR hwsrv-1333695.hostwindsdns.com)
DNS unchanged. No AAAA published.
```

## Fixes applied this session

1. Inserted nginx `location = /google/start` and `/google/callback` on live `auth.picom.gg` (backup `auth.picom.gg.bak-20260823`).
2. Synced repo `services/auth-gateway` into `/opt/picom/services/auth-gateway` and rebuilt `picom-auth-gateway`.
3. Replaced gateway `SUPABASE_SERVICE_ROLE_KEY` with `SUPABASE_ANON_KEY` for project `cqnsetsmcduraryemhbi`. Service role remains on email-worker / event-reminder only.

## Proven live

- External HTTPS `picom.gg` → 200, TLS verify 0
- External HTTPS `account.picom.gg` `/` `/login` `/forgot` `/reset` `/support` → 200
- External HTTPS `auth.picom.gg/health` → 200 `{"ok":true,"host":"auth.picom.gg",...}`
- External `/google/start` `/steam/start` `/epic/start` without nonce/state → gateway HTML 400 (not nginx 404)
- `steam-auth` Edge → HTTP 200
- Let's Encrypt certs valid (picom.gg to 2026-10-12, account to 2026-10-24, auth to 2026-10-30)
- certbot.timer enabled+active
- ufw active; 22/80/443 allowed; default deny incoming

## Not proven / blocked

- Real Google / Epic / Steam identity → Desktop callback → Supabase session
- Email login, register, password-reset completion (no operator dedicated identities)
- Electron warm/cold/replay deep-link
- Session restore
- Account linking (production `auth.identities` social count = 0)
- Packaged Windows secret scan (no `release/` artifact this run)
- Controlled reboot (skipped after recent multi-day outage)
- `epic-auth` Edge function is **not deployed** (HTTP 404)
- Production Edge secrets have no `EPIC_CLIENT_ID` / `EPIC_CLIENT_SECRET` / `EPIC_DEPLOYMENT_ID`

## Verdict

```text
NOT PRODUCTION READY — real provider E2E + epic-auth missing + no dedicated test identities
```
