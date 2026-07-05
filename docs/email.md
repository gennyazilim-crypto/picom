# Email Service Placeholder

Picom has a backend-only email service placeholder for future Edge Function flows.

## Supported placeholder intents

- `email_verification_placeholder`
- `password_reset_placeholder`
- `invite_placeholder`
- `security_alert_placeholder`
- `notification_digest_placeholder`

## Service location

`supabase/functions/_shared/email-service.ts`

The service exposes:

- `sendEmail()`
- `sendPasswordResetEmailPlaceholder()`
- `sendVerificationEmailPlaceholder()`
- `sendInviteEmailPlaceholder()`

## Development behavior

`EMAIL_PROVIDER=log` records a safe email intent only:

- intent type
- recipient domain
- subject
- redacted metadata

It does not send real email and does not log full tokens, passwords, auth headers, cookies, or provider secrets.

## SMTP placeholder

`EMAIL_PROVIDER=smtp_placeholder` is reserved for a later provider implementation. It currently returns `SMTP_PROVIDER_NOT_CONFIGURED`.

Do not add real credentials to source control. Future SMTP values must live in Supabase function secrets or a production secret manager.

## Environment placeholders

```env
EMAIL_PROVIDER=log
SMTP_HOST_PLACEHOLDER=
SMTP_PORT_PLACEHOLDER=
SMTP_USER_PLACEHOLDER=
SMTP_PASS_PLACEHOLDER=
```

## Validation

```powershell
npm run email:smoke
```
