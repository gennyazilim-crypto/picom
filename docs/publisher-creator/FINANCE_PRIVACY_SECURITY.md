# Finance Privacy & Security

- No full tax IDs / IBAN / passport in UI or logs
- RPCs return redacted/masked fields
- `finance.read` / `finance.approve` only — not `dashboard.read`
- Webhook secrets server-only
- FINANCE_RETENTION_POLICY: PENDING_LEGAL_POLICY (no auto-delete)
