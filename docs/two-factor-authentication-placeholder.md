# Two-Factor Authentication Placeholder

Picom prepares a future Supabase MFA flow without enabling production two-factor authentication yet. This placeholder is intentionally conservative: it does not generate shared secrets, QR codes, raw recovery codes, or backup codes in the renderer.

## Current behavior

- Settings > Account shows two-factor authentication status.
- Enable/Disable actions only update local placeholder state.
- Recovery code regeneration is represented as a safe placeholder message.
- No passwords, tokens, authorization headers, MFA secrets, or raw recovery codes are logged or stored.

## Future Supabase MFA requirements

- Use Supabase Auth MFA APIs or a trusted backend flow for enrollment and verification.
- Display recovery codes only once after generation.
- Store only backend-managed hashes or provider-managed MFA state.
- Require recent re-authentication before disabling MFA or regenerating recovery codes.
- Update login to handle an MFA-required challenge without breaking mock mode.

## Manual verification

1. Open Settings > Account.
2. Click Enable 2FA placeholder.
3. Confirm the status changes to a prepared placeholder state.
4. Click Recovery codes placeholder and confirm no codes are displayed.
5. Click Disable 2FA placeholder and confirm the state resets.