# Payout Operations Runbook

Target: `cqnsetsmcduraryemhbi`

Flags OFF until provider + legal gates clear.

Worker: `claim_publisher_payout_jobs` (SKIP LOCKED) — do not deploy without provider.

Manual: holds via `root_create_publisher_payout_hold` / release. Never mark PAID from root UI.

Live payout: OFF.
