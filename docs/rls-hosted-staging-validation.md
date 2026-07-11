# Hosted staging RLS validation

This gate validates deployed Picom policies through the same anon/authenticated API boundary used by the
Electron renderer. It is staging-only and never accepts a service-role key. The manifest at
`supabase/tests/hosted/full-mvp-rls-matrix.json` is the authoritative actor/content matrix.

## Synthetic staging fixture

Create isolated Text, Radio, and Podcast staging communities plus ordinary synthetic Auth accounts for
Owner, Admin, Moderator, Member, Visitor, blocked participant, and DM non-participant. Seed dedicated
canary rows for public/private channels, messages, replies, reactions, attachments, Radio sessions,
Podcast episodes, content mentions, followed stories, friend requests, Direct Messages, audit rows, and
private Storage objects. Owner and Member are DM participants; the blocked actor remains a conversation
participant with `blocked_at` set and must not send. Never use production data or customer accounts.

The runner performs real SELECT, INSERT, UPDATE, DELETE, Storage download, and Realtime topic authorization
probes. Message deletion is the product soft-delete path, so staging canary tombstones are expected and may
be purged only by an approved staging maintenance process.

## Required process environment names

- `PICOM_RLS_STAGING_URL`, `PICOM_RLS_STAGING_ANON_KEY`
- `PICOM_RLS_STAGING_CONFIRM=STAGING_ONLY`
- `PICOM_RLS_MUTATION_CONFIRM=ALLOW_EPHEMERAL_WRITES`
- `PICOM_RLS_COMMUNITY_ID`, `PICOM_RLS_PUBLIC_CHANNEL_ID`, `PICOM_RLS_PRIVATE_CHANNEL_ID`
- `PICOM_RLS_PRIVATE_MESSAGE_ID`, `PICOM_RLS_PRIVATE_ATTACHMENT_ID`
- `PICOM_RLS_PRIVATE_STORAGE_BUCKET`, `PICOM_RLS_PRIVATE_STORAGE_PATH`
- `PICOM_RLS_<ROLE>_EMAIL` and `PICOM_RLS_<ROLE>_PASSWORD` for every authenticated actor printed by the safe preflight
- The remaining fixture names printed by `npm run supabase:rls:hosted:preflight`

Set these only in the current shell or an approved secret runner. Do not write them to tracked files, shell
history, logs, screenshots, diagnostics, or checkpoint documents.

## Run

```powershell
npm run supabase:rls:hosted:preflight
npm run supabase:rls:hosted:test
```

The preflight makes no network request. The `--run` command requires both confirmations, authenticates each
synthetic user, validates role fixtures, then executes the full manifest. It prints labels only, never IDs,
emails, passwords, tokens, object contents, URLs, or response payloads. Any unexpected allow is a release
No-Go. A privileged Dashboard/SQL Editor query is not RLS evidence.

## Current execution record - 2026-07-11

Status: **BLOCKED / NOT RUN**.

- No ignored staging env file is present in the workspace.
- No staging URL, anon key, seven synthetic account credential pairs, or Full MVP fixture inventory is present in the process env.
- Supabase CLI is unavailable, although this hosted runner does not require the CLI.
- Structural RLS smoke remains available but is not hosted evidence.

Required unblock: an operator must provision the isolated fixture and inject the preflight-named values
through an approved secret channel. Rerun the hosted command and store redacted label-only output in the
private release evidence store. Any unauthorized read/write or topic join keeps the release at No-Go.
