# Business Content Moderation Runbook

## Product checklist

1. Verify organization Business badge active
2. Review product type vs prohibited/restricted policy
3. Inspect media malware/processing state (pending ≠ clean)
4. Validate HTTPS CTA / destination domain display
5. Check pricing consistency (compare-at ≥ price)
6. Decide approve / requires_changes / reject / suspend with reason code

## External links

Reject javascript/data/file/private IPs. Quarantine malicious destinations. Do not paste full malicious URLs into outbound email.

## Trademark / counterfeit

Open report case; do not auto-revoke from report count alone.

## Promotion snapshots

Snapshots are immutable. Re-review requires a new snapshot version. Do not activate campaigns from Root without advertising delivery controls (out of scope here).

## Audit

All Root decisions append to `business_content_moderation_history`.
