# Live Now Disaster Recovery

## Recoverability inventory

| Asset | Recovery notes |
|-------|----------------|
| Supabase DB | Hosted backups / dashboard restore to **non-production** only |
| Migrations | Forward-only; **NO migration repair**; **NO history rewrite** |
| Edge Functions | Redeploy from git (`supabase functions deploy`) |
| Workers | Redeploy containers/systemd units from `services/*` |
| LiveKit config | VPS config + secrets vault; rooms ephemeral |
| Ingress | Restart container; RTMP listener; webhook URL |
| Nginx / TLS / DNS | VPS + DNS provider; TLS cert renewal |
| SMTP | Provider credentials in secret store (not git) |
| Media storage (future) | BLOCKED_STORAGE_CREDENTIAL — no production restore path yet |

## Database backup status

Record actual values at evidence time (do not assume):

```
AUTOMATED_BACKUP: <probe result>
PITR: <probe result>
MANUAL_EXPORT: capability via Supabase dashboard / pg_dump with service credentials (ops-owned)
```

Never restore over production.

## Restore drill

```
RESTORE_DRILL: NOT_RUN_NO_SAFE_ISOLATED_TARGET
```

Backup existence alone does **not** make DR GO.

## Migration recovery

1. Failed forward migration → stop deploy; fix forward; never repair history.
2. Rollback policy → feature flags / kill switches / forward-fix, not destructive down migrations for data changes.
3. No automatic down migrations for production data.

## LiveKit DR

- Restart LiveKit / Ingress services on VPS `23.254.166.240`
- Restore API key/secret from secret store
- Validate DNS `voice.picom.gg` + TLS :443
- Rooms are ephemeral — active media sessions do not survive host loss
- No multi-region HA claim unless provisioned

## Worker recovery

- Restart-safe claim RPCs (SKIP LOCKED)
- Idempotent reminder/email completion
- Stale lock handling via claim windows
- Idle empty queue ≠ failure
- Prefer isolated/internal queues for kill/restart simulation

## Secret recovery

Classify sources (values never in evidence):

- Supabase URL/anon/service_role
- LiveKit API key/secret
- SMTP user/password
- Future payment / recording storage

Verify secrets are not repository-tracked (`npm run secrets:smoke`).

## SPOFs

- Single VPS LiveKit SFU
- Single Ingress host (same constrained VPS class)
- SMTP provider
- Single Supabase project `cqnsetsmcduraryemhbi`
- DNS for `voice.picom.gg` / `picom.gg`
- Future media storage (not yet configured)

## Capacity

No production stress tests. Recording Egress remains **BLOCKED_INFRASTRUCTURE** until real capacity is provisioned.

```
MEDIA_CAPACITY_LOAD_CERTIFICATION: NOT_RUN
```
