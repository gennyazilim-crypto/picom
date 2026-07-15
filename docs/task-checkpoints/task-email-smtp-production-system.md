# Picom Email and SMTP Production System

**Date:** 2026-07-15

## Delivered

- Durable RLS-backed queue, attempts, events, suppressions, preferences, contact submissions, worker heartbeats, and root admin RPCs.
- Protected Supabase Edge email API with auth, RBAC, origin checks, rate limits, Turnstile support, unsubscribe verification, and fixed email intents.
- Real Nodemailer Spacemail worker with retry/backoff, suppression, observability, and health endpoint.
- Settings email preferences, real Help & Support submission, and root Email Operations module.
- Auth templates, ten-locale transactional renderer, CI contracts, Ubuntu/systemd/Docker/Nginx assets, and 35-task documentation.

## Verified now

- Spacemail TLS endpoint is reachable with an authorized TLS 1.3 certificate.
- MX, SPF, and DKIM (`spacemail` selector) records are present.
- Repository security and functional contracts are available through the email scripts.
- Migration `20260715150000` is recorded in the linked hosted project.
- Hosted `email-api` version 2 is ACTIVE with JWT verification handled inside the function.
- Hosted fail-closed checks passed for unauthenticated preferences, missing Turnstile, and untrusted origins.
- Ubuntu image `picom-email-worker:staged` was rebuilt with Nodemailer 9.0.3; production dependency audit reports zero vulnerabilities.
- Staged image digest: `sha256:a00a4f3725ddbeef4650bb2b04c378e40b0e1704bb297d79a923fd88161c8716`.

## Remaining production blockers

- SMTP mailbox password was not available, so authentication and real sending were not tested.
- DMARC is absent; SPF and DKIM are verified.
- Supabase custom SMTP remains blocked by the mailbox password. Hosted Auth URL and template configuration is handled through the Management API in this checkpoint.
- Ubuntu worker and multi-provider deliverability acceptance require the SMTP credential.

## Follow-up closure work

- Added authoritative account-security, moderation, appeal, and ownership-transfer queue hooks with durable metadata-only hook-failure records.
- Removed the two existing QA branding violations in voice overlay fallback styling and source commentary.
- Confirmed the Ubuntu worker image is staged but intentionally stopped until its protected environment can be completed.

The Ubuntu Docker image is staged but intentionally not running without SMTP credentials. The email subsystem remains **No-Go** for production until these external evidence gates pass.
