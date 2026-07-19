# Remaining Nine Email Tasks - Completion Report

**Reviewed:** 2026-07-15

| Item | Result | Evidence or blocker |
| --- | --- | --- |
| 1. SpaceMail server settings | Complete | `mail.spacemail.com`, SSL SMTP 465 (587 alternative) confirmed from provider settings. |
| 2. Domain authentication | Partial | MX, SPF, and DKIM selector `spacemail` pass; DMARC is still absent. |
| 3. Supabase custom SMTP | Blocked | Host/user/sender are known; the mailbox password is not available in an approved secret store. |
| 4. Supabase Auth URLs | Complete in hosted configuration pass | Production Site URL and exact desktop/HTTPS redirects are applied through the Management API. |
| 5. Supabase Auth templates | Complete in hosted configuration pass | Seven Picom templates and matching subjects are applied through the Management API. |
| 6. Ubuntu email worker | Staged, not running | Docker image is built and audited; protected SMTP and Supabase worker secrets are absent on the host. |
| 7. Public contact anti-abuse | Blocked | The API fails closed; a Turnstile site/secret pair is not available. |
| 8. Security and moderation hooks | Complete | Authoritative account, moderation, appeal, and ownership events enqueue idempotent emails; failures are durably recorded. |
| 9. Real delivery acceptance | Blocked | Requires SMTP authentication, running worker, and real Gmail/Outlook inbox/header/spam checks. |

Billing email remains intentionally disabled because Picom has no authoritative production billing webhook or legal approval. This is a safety decision, not a hidden pass.

## Release decision

The repository and hosted queue/API are ready, but production email remains **No-Go** until the four external gates are supplied: SMTP password, DMARC record, Turnstile credentials, and real mailbox delivery evidence.
