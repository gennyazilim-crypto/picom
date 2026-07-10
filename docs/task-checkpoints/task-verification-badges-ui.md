# Task checkpoint: Verification badges UI

## Result

A shared, original Picom verification badge now renders beside verified user and official community names across core desktop surfaces. The badge is derived from trusted verification records or a fixed mock allowlist, never from user-authored names, text, images, roles, or message content.

## Surfaces

- Profile display name
- Mention Feed author
- Community message author
- Member Sidebar rows
- Direct Message conversation list and header
- Official Community header
- ServerRail official-community tooltip

## Badge variants

- Verified user
- Official community
- Picom staff
- Verified bot placeholder

The compact rosette/check shape is CSS-rendered with Picom design tokens and includes a keyboard-accessible tooltip. It is visually distinct from role and bot labels.

## Validation

```powershell
npm run typecheck
npm run mock:smoke
npm run build
```
