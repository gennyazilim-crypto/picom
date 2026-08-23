# PICOM Payout, Tax, Reconciliation & Ad Transparency — Preflight

**Date:** 2026-08-03  
**Branch:** `feat/community-rebuild`  
**HEAD:** `f94180a34759ed5045184f9631831db49e89aa96`

## Dirty tree policy

Brand/installer/tmp/DM/CSS/`vite.config.web.ts`/FeedLiveNow dirt present. Do not stage.

## Mapping

| Required concept | Existing canonical | Missing | Additive change | Provider dep | Legal dep | Migration | Worker | UI |
|---|---|---|---|---|---|---|---|---|
| Monetization accounts | `monetization_accounts` | application lifecycle, status expansion | ALTER + applications | — | agreements | Y | N | Creator/Publisher routes |
| Revenue contracts | `revenue_share_contracts` | basis points, reserve %, promotional flag, approval | ALTER | — | active copy | Y | N | Root |
| Accruals | `partner_revenue_accruals` + `ad_partner_attributions` | reserved_for_payout/processing, holds | ALTER + holds/reserves | — | — | Y | hold release | Earnings UI |
| Revenue ledger | `revenue_ledger` append-only | do not duplicate | Link from accruals/payouts | — | — | N | — | — |
| Payout profile | none | connected account model | New tables | Stripe Connect | — | Y | refresh | Onboarding |
| Tax profile | none | private tax lifecycle | New private table | tax provider | tax notice | Y | expiry | Tax UI |
| Agreements | advertising_legal_* pending | monetization legal versions + acceptances | New tables seed pending_legal | — | LEGAL COPY | Y | N | Agreements UI |
| Payout batches/items | none | batch + mapping + dual approval | New tables + RPCs | payout provider | — | Y | process | Root finance |
| Provider webhooks | `provider_webhook_events` | payout event normalization | Extend usage | webhook secret | — | Y | reconcile | — |
| Idempotency | `platform_idempotency_keys` | reuse | Scope keys | — | — | N | — | — |
| Balance | none computed | server resolver | RPC + snapshot | — | — | Y | daily snapshot | Dashboard |
| Transparency archive | delivery decisions/snapshots | public archive | New archive tables | — | retention | Y | materialize | Public routes |
| Root finance | RevenuePage / FinanceApproval | full console | Expand RevenuePage + RPCs | — | — | Y | N | Root |
| Kill switches | ad_platform_settings pattern | payout settings | `payout_platform_settings` | — | — | Y | N | Root toggle |

## Preserved blockers

Do not fake-resolve: production project, hosted apply, Stripe/payout secrets, tax provider, Docker pgTAP, legal copy, real payout send, hosted workers, advertising placements default disabled.
