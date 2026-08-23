# Edge Function Deploy Manifest (TASK 07)

Production deploy: **BLOCKED** (mutation guard incomplete).

Canonical functions relevant to paid platform (source present under `supabase/functions/`):

| Function | Role | Deploy this task |
| --- | --- | --- |
| billing-checkout | Verified checkout session | NOT DONE |
| billing-portal | Customer portal | NOT DONE |
| billing-webhook | Stripe billing webhook | NOT DONE |
| verification-account-session | Identity verification session | NOT DONE |
| business-document-upload-session | Business docs | NOT DONE |
| business-domain-verification-check | Domain verification | NOT DONE |
| business-product-media-upload-session | Product media | NOT DONE |
| ads-delivery | Ad resolve/delivery | NOT DONE |
| payout-onboarding-link | Payout onboarding | NOT DONE |
| webhooks-payout-provider | Payout webhooks (fail-closed without secrets) | NOT DONE |
| validate-file | Attachment/malware gate helper | NOT DONE |
| client-config | Client config | NOT DONE |
| health / admin-health | Health | NOT DONE |

Source hashes are recorded in `docs/release/production-release-manifest.json` when generated.

## Post-deploy canary checklist (when authorized)

- unauthenticated denial
- valid authenticated request
- invalid role denial
- missing secret fail-closed
- invalid signature denial
- CORS allowlist
- rate limiting
- structured errors
- secret leak scan on responses/logs
