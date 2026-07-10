# Hosted staging RLS validation

This gate validates deployed Picom policies through the same anon/authenticated API boundary used by the
Electron renderer. It is read-only, staging-only, and never accepts a service-role key.

## Synthetic staging fixture

Create an isolated public staging community with public read enabled, one public text channel, one private
text channel, a private-channel message, attached metadata, and a private Storage object. Create five
ordinary Auth users assigned as Owner, Admin, Moderator, Member, and non-member Visitor. The current policy
expects Owner/Admin to read the private fixture and Moderator/Member/Visitor to receive no private rows or
Storage object. Never use production data or customer accounts.

## Required process environment names

- `PICOM_RLS_STAGING_URL`, `PICOM_RLS_STAGING_ANON_KEY`
- `PICOM_RLS_STAGING_CONFIRM=STAGING_ONLY`
- `PICOM_RLS_COMMUNITY_ID`, `PICOM_RLS_PUBLIC_CHANNEL_ID`, `PICOM_RLS_PRIVATE_CHANNEL_ID`
- `PICOM_RLS_PRIVATE_MESSAGE_ID`, `PICOM_RLS_PRIVATE_ATTACHMENT_ID`
- `PICOM_RLS_PRIVATE_STORAGE_BUCKET`, `PICOM_RLS_PRIVATE_STORAGE_PATH`
- `PICOM_RLS_<ROLE>_EMAIL` and `PICOM_RLS_<ROLE>_PASSWORD` for `OWNER`, `ADMIN`, `MODERATOR`, `MEMBER`, `VISITOR`

Set these only in the current shell or an approved secret runner. Do not write them to tracked files, shell
history, logs, screenshots, diagnostics, or checkpoint documents.

## Run

```powershell
npm run supabase:rls:hosted:preflight
npm run supabase:rls:hosted:test
```

The runner authenticates each synthetic user, verifies its membership/role, then tests public channel and
private channel/message/attachment/Storage visibility. It prints labels and booleans only, never IDs,
emails, passwords, tokens, object contents, or URLs. Any unexpected allow is a release blocker.

## Current execution record - 2026-07-10

Status: **BLOCKED / NOT RUN**.

- No ignored staging env file is present in the workspace.
- No staging URL, anon key, synthetic account credentials, or fixture IDs are present in the process env.
- Supabase CLI is unavailable, although this hosted runner does not require the CLI.
- Structural RLS smoke remains available but is not hosted evidence.

Required unblock: an operator must provision the isolated fixture and inject the named values through an
approved secret channel. Rerun the hosted command and store redacted output in private release evidence.
