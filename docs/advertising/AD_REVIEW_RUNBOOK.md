# Ad review runbook

1. Advertiser submit → Root activate/limit/suspend with reason codes + idempotency.
2. Campaign submit → Root approve/reject (Business badge does not bypass).
3. Creative approve requires review decision; snapshots remain immutable.
4. Destination HTTPS validation; block unsafe schemes.
5. Political / prohibited categories: reject.
6. Restricted categories: manual review.
7. Malware / URL reputation provider absent → do not auto-approve high-risk assets; keep BLOCKED.
8. Appeals: re-review via new append-only decision rows.
9. Placement/global kill switches take effect immediately on new delivery decisions.
10. Audit: review decisions append-only; financial adjustments are new ledger rows.
