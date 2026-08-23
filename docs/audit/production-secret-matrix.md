# Production Secret Matrix (names only)

**Rule:** secret **values** and prefixes are never logged here.  
**Environment:** production target candidate `cqnsetsmcduraryemhbi` — configuration presence not proven under mutation guard.

| Secret name | Target service | Environment | Configured | Rotation owner | Last rotation | Required before rollout | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STRIPE_SECRET_KEY | Billing Edge Functions | production | unknown | billing | unknown | yes (test-mode first) | BLOCKED |
| STRIPE_WEBHOOK_SECRET | billing-webhook | production | unknown | billing | unknown | yes | BLOCKED |
| STRIPE_IDENTITY_WEBHOOK_SECRET | verification session webhook | production | unknown | trust-safety | unknown | yes for identity | BLOCKED |
| STRIPE_PRICE_MONTHLY_ID | billing-checkout | production | unknown | billing | unknown | yes | BLOCKED |
| STRIPE_PRICE_YEARLY_ID | billing-checkout | production | unknown | billing | unknown | yes | BLOCKED |
| PAYOUT_PROVIDER_SECRET | payout-onboarding / worker | production | unknown | finance | unknown | yes (test-mode) | BLOCKED |
| PAYOUT_PROVIDER_WEBHOOK_SECRET | webhooks-payout-provider | production | unknown | finance | unknown | yes | BLOCKED |
| PAYOUT_ONBOARDING_RETURN_URL | payout onboarding | production | unknown | finance | unknown | yes | BLOCKED |
| PAYOUT_ONBOARDING_REFRESH_URL | payout onboarding | production | unknown | finance | unknown | yes | BLOCKED |
| ADS_DELIVERY_SIGNING_SECRET | ads-delivery | production | unknown | ads | unknown | yes | BLOCKED |
| ADS_CLICK_SIGNING_SECRET | ads click redirect | production | unknown | ads | unknown | yes | BLOCKED |
| ADS_CONVERSION_SIGNING_SECRET | conversion ingest | production | unknown | ads | unknown | yes | BLOCKED |
| FRAUD_PROVIDER_SECRET | invalid-traffic worker | production | unknown | ads | unknown | recommended | BLOCKED |
| URL_REPUTATION_PROVIDER_SECRET | creative URL checks | production | unknown | ads | unknown | recommended | BLOCKED |
| SUPABASE_SERVICE_ROLE_KEY | workers / privileged jobs | production | unknown | sre | unknown | yes | BLOCKED |
| SMTP credentials | email-worker | production | unknown | ops | unknown | yes | BLOCKED |
| MALWARE_SCANNER_SECRET | validate-file / storage pipeline | production | unknown | security | unknown | yes for document GO | BLOCKED |
| MONITORING_WEBHOOK / OTEL | alerting | production | unknown | sre | unknown | yes | BLOCKED |
| WORKER_DB_URL (least-privilege role) | workers | production | unknown | sre | unknown | yes | BLOCKED |

Configured column is **unknown** until a vault inventory is exported by an authorized operator without pasting values into git.
