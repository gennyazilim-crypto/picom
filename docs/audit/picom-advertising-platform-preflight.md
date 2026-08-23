# PICOM Advertising Platform — Prefligh

**Date:** 2026-08-03
**Branch:** `feat/community-rebuild`
**HEAD:** `2b77f7256021f20fdd317d96b2cf7cb9aaf4225d`

## Dirty tree policy

Brand/installer/tmp/DM/CSS/`vite.config.web.ts` dirt present. Do not stage.

## Mapping

| Required concept | Existing canonical | Missing | Additive change | External dependency | Migration | Worker | UI |
|---|---|---|---|---|---|---|---|
| Advertiser accounts | `advertiser_accounts` + members + `create_advertiser_account` | funding fields, spend limits, terms, risk/status expansion | ALTER + onboarding RPCs | verification provider | Y | N | Advertise routes |
| Advertiser team | `advertiser_account_members` | invitations, ownership transfer, role map expansion | invitations + transfer RPCs | — | Y | N | Team UI |
| Campaigns | `ad_campaigns` (Root ops) + promotion draft bridge | advertiser FK complete, budgets, transitions, funding gate | ALTER + lifecycle RPCs | payment provider | Y | scheduler | Advertiser dashboard |
| Ad sets | none | targeting, frequency, pacing | New table + RPCs | — | Y | N | Campaign wizard |
| Creatives | `ad_creative_snapshots` (Business bridge) | editable creative drafts | `ad_creatives` + snapshot link | — | Y | N | Creative editor |
| Placements | none registry | kill switches | `ad_placements` seed | — | Y | N | Root toggle |
| Delivery | `resolve_ad_eligibility` + sponsored eligibility | candidate resolve + tokens | `resolve_ad_delivery` | signing secret | Y | N | Feed consumers later |
| Impressions/clicks | none | billable events | tables + Edge | — | Y | N | — |
| Funding/ledger | none ad-specific; `revenue_ledger` partner | funding + spend + reservation | New append-only | payment E2E | Y | reconcile | Billing UI |
| Partner attribution | `monetization_accounts`, contracts, revenue_ledger | ad attribution/accrual | New tables + reconcile RPC | payout provider | Y | Y | Partner read |
| Invalid traffic | none | rule engine | status fields + mark RPC | fraud provider | Y | Y | Root |
| Transparency | none | explanation DTO | RPC | — | Y | N | Why-this-ad |
| Hide/report | none ad-specific | preferences | tables + RPCs | — | Y | N | Public actions |
| Legal | business_legal_* pending | advertising policies | seed pending_legal | legal approval | Y | N | Gates |
| Docker/pgTAP | harness | engine | — | Docker | — | — | — |

## Preserved blockers

Do not fake-resolve: production project, hosted apply, Stripe, malware, URL reputation, legal copy, Docker pgTAP, payment/fraud/conversion provider E2E, hosted workers, payout.
