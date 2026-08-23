# PICOM public infrastructure + auth recovery — evidence

Audit time: 2026-08-16T18:50Z
Workstation: Windows client with working internet (1.1.1.1:443 OPEN 16ms, example.com:443 OPEN).
Independent path: Cursor WebFetch + check-host.net nodes (RO, RU, SG, SI, UA, ID, IL, TR, GB, ES, IR, US-NY).

## Host identity

```text
EXPECTED_IP: 23.254.166.240
ACTUAL_DNS_A: 23.254.166.240 (picom.gg, www, account, auth, app, support)
IP_MATCH: YES
AAAA: none published
PTR: 23.254.166.240 → hwsrv-1333695.hostwindsdns.com
PROVIDER: Hostwinds / HostPapa (ARIN NET-23-254-128-0-1 HOSTWINDS-17-6, AS54290)
SSH alias: picom-update-server (root@23.254.166.240, IdentityFile picom_update_ed25519)
VPS_RUNNING: UNVERIFIED (no SSH, no provider console session)
```

DNS was not changed. The production IP has not moved.

## Broken layer

NETWORK / HOST INGRESS on this single VPS IP.

Not DNS. TLS, nginx, Docker, ufw, and auth-gateway were not inspectable because TCP 22 never completes.

Control that this is not a path failure to Hostwinds:

```text
23.254.166.239:443  OPEN 130ms   (neighbor in same /24)
23.254.166.240:22   TIMEOUT
23.254.166.240:80   TIMEOUT
23.254.166.240:443  TIMEOUT
```

BGP: `23.254.128.0/17` is announced by AS54290 (339 RIPE collector routes). `23.254.166.0/24` is not a separate announcement (covered by the /17). Prefix routing exists; this host does not answer.

## What could not be done

Hostwinds Client Area loaded (`https://clients.hostwinds.com/clientarea.php`) and stopped at the login form. No console credentials are available in this session. 1Password MCP is disconnected.

Phases 4–23 (host firewall, listeners, nginx, TLS, services, real Google/Epic/Steam, reboot) require SSH or VNC/serial console.

## Do not treat as PASS

Local source compile, login UI, unit tests, or “route exists in repo” are not production proof. Live `https://picom.gg`, `https://account.picom.gg`, and `https://auth.picom.gg/health` all timed out.
