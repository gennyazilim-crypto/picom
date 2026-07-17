# Picom self-hosted SMS verification

Picom secret-community phone verification uses a self-hosted SMS control plane. Twilio is not used. The Supabase Edge Function creates a six-digit, five-minute challenge, persists only HMAC hashes and limited metadata, and sends a signed server-to-server request to the Picom SMS Gateway.

## Runtime

1. The authenticated desktop client invokes `secret-community-verification`.
2. The Edge Function rate-limits the account and phone bucket.
3. `secret_phone_sms_challenges` stores only hashes, last four digits, expiry, state, and attempt count.
4. The Edge Function signs the request with HMAC-SHA256.
5. The Picom gateway validates timestamp, nonce, signature, payload size, and E.164 format.
6. The gateway submits one GSM-7 message to loopback Kannel.
7. Kannel sends through a locally controlled GSM modem and SIM, or through an explicitly configured SMPP transport.
8. Correct code verification records `picom_self_hosted_sms_v1` and unlocks secret-community operations.

## Secrets

Supabase secrets:

- `PHONE_VERIFICATION_HASH_SECRET`
- `PICOM_SMS_VERIFY_BASE_URL`
- `PICOM_SMS_VERIFY_SHARED_SECRET`

Gateway-only secrets:

- `PICOM_SMS_GATEWAY_SHARED_SECRET` matching the Supabase shared secret
- `KANNEL_USERNAME`
- `KANNEL_PASSWORD`

Never commit these values. The public gateway URL must use HTTPS. Kannel remains loopback-only.

## Required physical transport

Sending an SMS to a public phone number always requires access to the mobile network. For the Picom-owned route, install Kannel with a supported GSM modem and active SIM on the server, or configure a controlled SMPP account. The application and verification control plane are self-hosted, but a GSM modem, SIM, or SMPP transport is still required for delivery.

## Deployment order

1. Apply `20260717233000_self_hosted_secret_sms_verification.sql`.
2. Install and configure Kannel with loopback-only HTTP access.
3. Install `services/secret-sms-gateway` under `/opt/picom/secret-sms-gateway`.
4. Create `/etc/picom/secret-sms-gateway.env` with mode `0600`.
5. Enable the hardened systemd unit.
6. Put Nginx TLS in front of the gateway.
7. Set matching Supabase secrets and deploy `secret-community-verification`.
8. Test one allowed number, expiry, wrong code, replay rejection, rate limiting, and duplicate phone ownership.

The retired voice-call gateway is not part of the active verification path. Historical migrations and audit records remain intact.