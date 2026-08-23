# auth.picom.gg ingress recovery

Audit date: 2026-08-16

## Layer evidence

| Layer | Result | Evidence |
| --- | --- | --- |
| DNS_RESOLUTION | PASS | `auth.picom.gg` A = `23.254.166.240` (Cloudflare 1.1.1.1, Google 8.8.8.8, and local resolver). Matches documented production host `picom-update-server`. No AAAA. |
| TCP_CONNECT_80 | FAIL — TIMEOUT | SYN to `23.254.166.240:80` timed out (~8s) from this workstation. |
| TCP_CONNECT_443 | FAIL — TIMEOUT | SYN to `23.254.166.240:443` timed out. |
| TCP_CONNECT_22 | FAIL — TIMEOUT | SSH `picom-update-server` (`root@23.254.166.240:22`) timed out. |
| ICMP | FAIL — TIMEOUT | 4/4 ping loss. |
| HTTPS_HANDSHAKE | NOT REACHED | TCP 443 never completed. |
| HTTP_RESPONSE | NOT REACHED | Not an application 4xx/5xx. |
| Independent path | FAIL — TIMEOUT | Cursor WebFetch to `https://picom.gg/`, `https://account.picom.gg/`, and `https://auth.picom.gg/health` also timed out. This workstation can reach `https://example.com` (HTTP 200) and `1.1.1.1:443`. |

Traceroute to `23.254.166.240` reached Cogent (`154.54.47.214`) then blackholed (hops 14–15 timeout). Destination never answered.

## Classification

Broken layer: **NETWORK** (host/provider ingress). Not DNS. TLS, reverse proxy, and auth service could not be inspected on the host because SSH/22 is also unreachable.

This is **not** an application-level auth failure.

### Case A vs Case B

```text
LOCAL HEALTH: UNVERIFIED (no SSH)
PUBLIC HTTPS: FAIL (TCP 443 timeout from workstation + independent WebFetch)
```

Cannot prove Case A (local pass / public fail) vs host down. Public TCP 22/80/443 all fail, so this is broader than an `auth.picom.gg` vhost miss.

## Repo gaps found (not the live timeout cause)

- `infra/nginx/auth.picom.gg.conf` was referenced by `deploy-on-server.sh` but missing from the tree.
- Deploy script previously seeded `SUPABASE_SERVICE_ROLE_KEY` into gateway env. The Node gateway requires `SUPABASE_ANON_KEY` and must never receive the service-role key.

## Repo fixes applied (not live)

- Added `infra/nginx/auth.picom.gg.conf` and logging snippet.
- Deploy script now refuses service-role keys and requires the anon key.

These cannot be applied on the server until `23.254.166.240` accepts SSH again.

Follow-up 2026-08-16T18:50Z: same IP still silent. Independent check-host nodes worldwide timed out on TCP 443 and ICMP. Neighbor `23.254.166.239:443` opened in 130ms from this workstation, so the Hostwinds /24 path works and **this VPS** does not. Evidence: `docs/audit/evidence/public-auth-recovery-2026-08-16T1850Z/`.

Follow-up 2026-08-23T21:35Z: ingress recovered. SSH works. External TCP 22/80/443 open. `https://picom.gg/` and `https://account.picom.gg/` return 200. `https://auth.picom.gg/health` returns 200. Google nginx locations added; gateway rebuilt with anon key only. `epic-auth` still 404. Real Google/Epic/Steam/email E2E still blocked. Evidence: `docs/audit/evidence/public-auth-recovery-2026-08-23T2135Z/`.

## Next operator action (out of band)

Ingress and public HTTPS are live again as of 2026-08-23. Remaining production blockers:

1. Deploy `epic-auth` to `cqnsetsmcduraryemhbi` only after `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET`, and `EPIC_DEPLOYMENT_ID` are set in Edge secrets.
2. Confirm hosted Google client id/secret + redirect allowlist include `https://auth.picom.gg/google/callback` and `picom://auth/callback`.
3. Provision dedicated production E2E identities and run real Google / Steam / email / deep-link / session-restore.
4. Do not reboot unless an operator is watching; last outage was a multi-day ingress blackhole.
