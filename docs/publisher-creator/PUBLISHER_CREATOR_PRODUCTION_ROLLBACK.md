# Publisher / Creator — Production Rollback

**Scope:** PICOM Publisher/Creator Phase 1 production incident response  
**Rule:** No migration down-scripts. Do not rewrite `schema_migrations`. Do not drop/truncate production tables.

## Preferred rollback order

1. **Feature flags OFF (server-enforced where available)**
   - Go Live / LiveKit broadcast gate
   - Live Now public discovery
   - Publisher application intake
   - Reminder worker dispatch
   - Notification preference mutation surfaces (keep read if needed)

2. **Stop production workers**
   - Reminder / outbox / email workers: stop process or set `PICOM_WORKER_ENV` health drain
   - Confirm health endpoints report not-serving

3. **Application release rollback**
   - Redeploy previous known-good Desktop/Web release candidate
   - Keep database as-is (forward-only schema remains)

4. **Do not**
   - Run `DROP` / `TRUNCATE` / column drops
   - Repair or rewrite migration history
   - Point production clients at staging refs (`ufmtvqtsklqsmqxefbbs`, `kbdotviopwlcqviggtrc`)
   - Delete real user data to “undo” a release

## Partial disable matrix

| Symptom | Immediate action |
|---|---|
| Bad Go Live / LiveKit tokens | Disable Go Live flag + revoke LiveKit API usage in worker secrets |
| Bad Live Now listing | Disable Live Now discovery flag; leave badge tables intact |
| Bad applications | Disable application intake; leave review panel for Root cleanup |
| Reminder spam | Stop reminder worker; cancel pending claims via service-role only ops script |
| Auth redirect broken | Revert Auth allowlist to last known-good from runbook; do not wipe Auth users |

## Evidence to capture after rollback

- Feature flag states
- Worker stop timestamps
- App release SHA restored
- Confirmation production guard still rejects staging refs
- Confirmation no destructive SQL was run

## Recovery

Re-enable only after:
- production config guard PASS
- JWT/RLS smoke PASS
- Case 04 / Case 18 / realtime revocation PASS (as applicable)
- secret scan PASS
