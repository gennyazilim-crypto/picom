# Task 332 - Session management production

Status: implemented; hosted Auth/Realtime validation pending.

- Safe device sessions are registered/listed without raw tokens.
- Current session is marked from a server-derived one-way session hash.
- Other Auth refresh sessions and registered device rows can be revoked.
- Realtime device revocation triggers protected-session sign-out where available.
- Settings refreshes the authoritative list.
- Existing access JWTs may remain until expiry; hosted two-client tests remain required.

Validation:
- `npm run auth:sessions:production:test`
- `npm run auth:sessions:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
