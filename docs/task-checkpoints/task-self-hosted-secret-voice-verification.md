# Self-Hosted Secret Voice Verification Checkpoint

## Scope

- Removed Twilio from the active Secret Community verification function.
- Added hash-only, short-lived verification challenges and service-role-only RPCs.
- Added a timestamped HMAC protocol between Supabase and the Picom gateway.
- Added a dependency-free Node.js gateway, Asterisk ARI transport, hardened systemd unit, and TLS proxy example.
- Preserved legacy provider labels for audit truth while making `picom_self_hosted_voice_v1` the only new provider.

## Release state

Application and Supabase code can be deployed independently and fail closed until the Picom gateway is healthy. Public telephone calls remain blocked until the Picom server has working SSH/operations access, TLS, and a configured SIP/PSTN trunk. No test or fallback path may mark a phone verified without successful code validation.