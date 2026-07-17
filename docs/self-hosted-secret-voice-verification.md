# Superseded: voice-call phone verification

This implementation was superseded by Picom self-hosted SMS OTP verification. It is retained only as historical implementation evidence. Active runtime, deployment, and security guidance is in `docs/self-hosted-secret-sms-verification.md`.

Historical voice challenge rows and migrations remain immutable for audit purposes. Service-role execution of the old voice challenge RPCs is revoked by migration `20260717233000_self_hosted_secret_sms_verification.sql`.