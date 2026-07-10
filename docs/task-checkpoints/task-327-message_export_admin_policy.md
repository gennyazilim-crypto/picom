# Task 327 - Message export admin policy

Status: policy complete; implementation intentionally not approved.

- Dedicated `exportMessages` authorization is required; `manageCommunity` alone is rejected for production.
- Private-channel authorization is re-checked at request, execution and download.
- Deleted/private/security content and secrets have explicit exclusion/redaction rules.
- Audit events are append-only and content-free.
- Private artefact storage, short-lived access, expiry and cleanup are defined.
- Privacy/legal/security/product approval and hosted adversarial tests remain release blockers.

Validation:
- Documentation-only task; no runtime code or package scripts changed.
- `npm run typecheck`, `npm run mock:smoke` and `npm run build` were intentionally skipped because Task 327 changes Markdown only.
