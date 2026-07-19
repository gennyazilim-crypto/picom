# Picom Intelligence Engine — Data Retention

**Task 09 · retention & deletion.** Storage-limitation by default: keep the least data for
the shortest time. Grounds on the shipped local caps (`analyticsService` 100-event queue,
Task 02 queue cap 500), crash/log redaction, and the account-deletion Edge Functions.

## Retention schedule

| Category | Where | Retention | Notes |
|---|---|---|---|
| Optional analytics — raw events | device queue → sink | **local: capped FIFO** (100 legacy / 500 Task 02); sink raw events **≤ 30 days** | dropped on consent-off; buckets only |
| Analytics — aggregates | server rollups | **≤ 25 months** (aligns with common analytics limits) | pseudonymous, no identity/content |
| Personalization profile | device only | until consent-off or sign-out; **decays continuously** | never server-stored per-user |
| AI assistant state | device / ephemeral | summaries **ephemeral**; digest state **≤ 7 days** | no content retained |
| Security/abuse signals | server | **≤ 180 days** (fraud/abuse legitimate interest) | salted-hash buckets, no raw IP |
| Rate-limit rows | server | **short window**; expired rows purged (already ≤ 1 day sweep for social-auth) | operational only |
| Consent records | server | **duration of account + ≤ 3 years** after (proof of consent) | required for compliance |
| Crash/diagnostic reports | device (opt-in) | **local, bounded envelope**; not sent without action | redacted; `crashReporterService` |
| Logs | device | **bounded ring buffer**; redacted | no tokens/secrets/content |
| Session-handoff (social auth) | server | **5 minutes, single-use** | `social_auth_handoffs`, then deleted |

Defaults favor the shorter option; any longer period must cite a specific legal/operational
justification and be recorded here.

## Deletion workflows

1. **Consent withdrawal** (per tier): stop collection + purge that tier's local data
   immediately (`analyticsService.setEnabled(false)` + `analyticsQueue.clear()`, clear
   personalization/AI state). Server aggregates are already non-identifying; the raw-event
   sink drops the user's future events and ages out existing raw events within the window.
2. **Delete optional data now** (local, instant): clears device queues, profile, and
   pending intelligence state.
3. **Account erasure** (GDPR Art. 17 / KVKK Art. 7): the `account-deletion` →
   `account-deletion-finalize` Edge Functions cascade user-owned records; a **grace window**
   allows cancellation; on finalize, personal data is deleted or irreversibly anonymized,
   backups age out per backup policy, and consent records retain only the proof-of-erasure.
4. **Automated expiry**: scheduled jobs purge raw analytics > window, security signals >
   window, expired rate-limit/handoff rows, and stale aggregates. Idempotent and logged.

## Guarantees
- No category is retained "indefinitely" without justification here.
- Erasure is verifiable and confirmable; backups converge to the deleted state within the
  documented backup horizon.
- Retention limits are enforced by automated jobs, not manual cleanup.
- Reviewed against the policy in [FINAL_INTELLIGENCE_AUDIT.md](./FINAL_INTELLIGENCE_AUDIT.md) (Task 10).
