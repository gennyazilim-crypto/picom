# Picom Self-Hosted Secret Voice Verification

## Decision

Twilio is not part of the Picom verification runtime. Supabase owns authentication, rate limits, hash-only challenges, expiry, attempt locking, and final verification state. A Picom-operated gateway owns call orchestration. Asterisk owns SIP call origination.

Real telephone delivery still requires a SIP/PSTN carrier and a caller ID or DID. This is a telephone-network requirement, not a Picom or Twilio software dependency. The gateway never treats a missing trunk as successful verification.

## Request path

1. The authenticated renderer invokes `secret-community-verification`.
2. The Edge Function validates the session, E.164 phone format, and database rate limit.
3. A six-digit code is generated with Web Crypto. Only HMAC hashes, last four digits, calling code, expiry, and attempt count are stored.
4. The Edge Function signs the exact gateway body with `timestamp.nonce.body` using HMAC-SHA256.
5. The Picom gateway validates the signature in constant time, enforces a 90-second clock window, rejects nonce replay, and asks Asterisk ARI to originate the call.
6. The user submits the code to the Edge Function. A service-role-only RPC atomically checks attempts, expiry, phone uniqueness, and records the approved provider as `picom_self_hosted_voice_v1`.

Raw phone numbers and codes exist only in process memory long enough to place the call. They are not written to Supabase, gateway logs, audit records, or source files.

## Supabase secrets

- `PICOM_VOICE_VERIFY_BASE_URL`: public HTTPS origin of the gateway
- `PICOM_VOICE_VERIFY_SHARED_SECRET`: at least 32 random bytes, shared only with the gateway
- `PHONE_VERIFICATION_HASH_SECRET`: independent HMAC secret for phone and code hashes
- `SUPABASE_SERVICE_ROLE_KEY`
- `PICOM_ALLOWED_ORIGINS`

Generate the two HMAC secrets independently. Never reuse the Supabase service-role key, LiveKit secret, SIP password, or ARI password.

## Server requirements

- Supported Linux host with Node.js 22 or newer
- Asterisk with HTTP and ARI bound to loopback only
- HTTPS reverse proxy for the gateway
- DNS name and valid TLS certificate
- SIP/PSTN carrier trunk capable of outbound calls to supported countries
- Firewall allowing public TCP 443 only; gateway port 8787 and ARI port 8088 remain private

Copy `services/secret-voice-gateway/server.mjs` to `/opt/picom/secret-voice-gateway/`, the systemd unit to `/etc/systemd/system/`, and the environment file to `/etc/picom/secret-voice-gateway.env` with mode `0600`. Install the Asterisk dialplan context from `services/secret-voice-gateway/asterisk/extensions.conf`. Adapt the PJSIP example to the selected carrier without committing credentials.

After configuring Asterisk and TLS:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now picom-secret-voice-gateway
curl --fail --silent https://<voice-verification-hostname>/health
```

Deploy the Supabase boundary only after the gateway health check succeeds:

```bash
npx supabase db push
npx supabase secrets set PICOM_VOICE_VERIFY_BASE_URL=https://<voice-verification-hostname> PICOM_VOICE_VERIFY_SHARED_SECRET=<secret>
npx supabase functions deploy secret-community-verification
```

## Security operations

- Synchronize server time with NTP; signed requests tolerate only 90 seconds.
- Keep Asterisk ARI on `127.0.0.1` and use a dedicated non-root gateway account.
- Disable Asterisk debug/full logging for the verification context to avoid exposing channel variables.
- Rotate gateway and ARI secrets independently and restart the gateway after rotation.
- Monitor call failure rate, gateway 401 responses, rate-limit events, and challenge lockouts without logging phone numbers or codes.
- Test one authorized account, one reused phone, one expired code, eight wrong attempts, replayed signatures, and gateway downtime before release.