# PRODUCTION DEPLOYMENT RUNBOOK — PICOM Paid Platform (TASK 07 + TASK 08)

**Hard rule:** every command must target an explicit project ref.  
**Default:** `HOSTED PRODUCTION MUTATION: BLOCKED` until `npm run production:mutation:guard` exits 0.

Staging ref: `ufmtvqtsklqsmqxefbbs`  
Production candidate ref: `cqnsetsmcduraryemhbi`  
Never apply Task migrations to staging while calling it production.

## TASK 08 status snapshot

| Check | Result |
| --- | --- |
| `.env.production` staging cleanup (local gitignored) | PASS after correction; config guard PASS |
| Docker clean reset | **FAIL** — sealed `20260803240000` `SQLSTATE 42601` (`as $`) |
| Additive view drop `20260803225000` | Present (fixes `42P16` before catalog) |
| Backup / restore / hosted apply / hosted RLS / edge | **BLOCKED** |
| Details | `docs/release/TASK08_HOSTED_MIGRATION_RUNBOOK.md`, `docs/audit/picom-task08-hosted-closure-readiness.md` |

Do **not** proceed past section 6 until clean reset and mutation guard both PASS.

## 1. Change approval

- Record `PRODUCTION_CHANGE_TICKET`
- Set `PRODUCTION_DEPLOY_APPROVED=true` only after dual control
- Confirm no SEV1/SEV2 active incident

## 2. Release SHA freeze

```bash
git rev-parse HEAD
git status --short
# Working tree for release files must be intentional; unrelated dirt must not ship.
export EXPECTED_RELEASE_COMMIT=<frozen_sha>
```

## 3. Manifest verification

```bash
npm run release:manifests:generate -- --release-commit=$EXPECTED_RELEASE_COMMIT
npm run migration:chain:static
export EXPECTED_MIGRATION_MANIFEST_SHA256=$(cut -d' ' -f1 docs/release/production-migration-manifest.sha256)
# Fail closed on mismatch:
test "$(cut -d' ' -f1 docs/release/production-migration-manifest.sha256)" = "$EXPECTED_MIGRATION_MANIFEST_SHA256"
```

## 4. Backup verification

- Confirm PITR enabled on **production** project `cqnsetsmcduraryemhbi`
- Record last successful backup timestamp + retention
- Confirm restore authority on-call

If any item unknown → **stop**.

## 5. Feature flags off

Confirm server-side defaults false / kill switches engaged:

- advertising global disabled / kill switch on
- payout processing disabled / global payouts kill switch on
- real_payouts_enabled = false

## 6. Mutation guard

```bash
export PICOM_ENVIRONMENT=production
export SUPABASE_PRODUCTION_PROJECT_REF=cqnsetsmcduraryemhbi
export SUPABASE_PRODUCTION_URL=https://cqnsetsmcduraryemhbi.supabase.co
export SUPABASE_PRODUCTION_DB_HOST=db.cqnsetsmcduraryemhbi.supabase.co
export SUPABASE_PRODUCTION_ORG_ID=<org>
export SUPABASE_ACCESS_TOKEN=<vault>
export PRODUCTION_CHANGE_TICKET=<ticket>
export PRODUCTION_DEPLOY_APPROVED=true
export EXPECTED_RELEASE_COMMIT=<sha>
export EXPECTED_MIGRATION_MANIFEST_SHA256=<sha>
npm run production:mutation:guard
```

## 7. Migration apply (only if guard PASS)

Exact list (example after foundation already applied on prod):

1. `20260803210000_picom_verified_subscription_and_entitlements.sql`
2. `20260803220000_business_application_verification_and_team_management.sql`
3. `20260803230000_business_catalog_brand_content_and_promotion_bridge.sql`
4. `20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql`
5. `20260803250000_partner_payout_tax_reconciliation_and_ad_transparency.sql`
6. `20260803260000_production_feature_canary_allowlist_and_rollout_gates.sql`

Log per migration: duration, SQLSTATE, lock wait, transaction outcome.  
On failure: **do not continue**; no destructive down migration.

Use Supabase CLI linked to **production** ref only:

```bash
# Pseudocode — operator must verify link target before apply
supabase link --project-ref cqnsetsmcduraryemhbi
supabase migration list --linked
# apply only after dry-run review
```

## 8. Schema / RLS verification

- migration history matches manifest versions
- RLS enabled inventory
- smoke queries (non-destructive)

## 9. Edge Function deploy

Deploy only after guard PASS. Prefer canary traffic. Record source SHA from release manifest.

## 10. Web / Account Center deploy

```bash
npm run production:config:guard
# Build/deploy pipelines must use production project URL — not staging ref.
```

## 11. Worker deploy (processing disabled)

Deploy immutable digests only (never `:latest`). Keep claim/lease processing disabled until Stage 1.

## 12. Smoke tests

Unauth denial, auth happy-path, invalid role denial, webhook signature fail-closed.

## 13. Internal canary

Root inserts `feature_canary_allowlist` rows with **mandatory expiry**. No public ads.

## 14. Monitoring hold

Watch CRITICAL alerts for agreed window before Stage 2.

## 15. Closed-beta flag enable

Use `config/rollout/closed-beta.v1.json` limits. Do not embed limits in client as security control.

## 16. Post-deploy reconciliation

Finance + ads reconciliation jobs dry-run; variance = 0 within threshold.

## 17. Sign-off

Owners: platform-sre, finance, legal, security.

## 18. Rollback criteria

See `docs/release/PRODUCTION_ROLLBACK_PLAN.md`. Immediate flag/kill-switch shutdown preferred over schema down-migrations.
