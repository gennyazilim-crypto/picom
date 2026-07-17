# Checkpoint: self-hosted SMS verification

- Scope: replace secret-community verification calls with six-digit SMS OTP.
- Provider: `picom_self_hosted_sms_v1`.
- Backend: Supabase Edge Function plus service-role-only hash challenge RPCs.
- Gateway: Picom HMAC gateway to loopback Kannel.
- Transport: operator-controlled GSM modem/SIM or SMPP; Twilio is not used.
- Privacy: raw phone and OTP are never persisted in Picom tables or gateway logs.
- Compatibility: the legacy eligibility RPC output name remains for old desktop clients but is backed by `sms_verified_at`.
- Old voice challenge RPCs: disabled for service-role execution; historical records preserved.
- Operational blocker: real SMS delivery cannot pass until Kannel has an active mobile-network transport and the HTTPS gateway is deployed.