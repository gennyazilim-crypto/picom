# Realtime staging validation

The hosted runner exercises Supabase Realtime using two ordinary synthetic users in one isolated staging
community/channel. It creates one harmless message, updates and deletes it, tests private typing Broadcast,
two-client Presence, socket reconnect, exact event counts, and channel cleanup. It never uses service-role.

## Required process values

- `PICOM_REALTIME_STAGING_URL`, `PICOM_REALTIME_STAGING_ANON_KEY`
- `PICOM_REALTIME_STAGING_CONFIRM=STAGING_ONLY`
- `PICOM_REALTIME_CLIENT_A_EMAIL`, `PICOM_REALTIME_CLIENT_A_PASSWORD`
- `PICOM_REALTIME_CLIENT_B_EMAIL`, `PICOM_REALTIME_CLIENT_B_PASSWORD`
- `PICOM_REALTIME_COMMUNITY_ID`, `PICOM_REALTIME_CHANNEL_ID`

Both users must be distinct members allowed to read/write the text channel. Set values only through an
approved secret runner/current shell; do not store them in tracked files or release evidence.

```powershell
npm run realtime:staging:preflight
npm run realtime:staging:test
```

The test expects exactly one INSERT, UPDATE, and DELETE event per client; one typing delivery before and
after reconnect; both users in Presence; reconnect resubscription; and zero channels after cleanup. The test
message is deleted in normal and failure cleanup paths. Any private payload/logging or duplicate/lost event
is a release blocker.

## Current result - 2026-07-10

Status: **BLOCKED / NOT RUN**. No staging URL/anon key, synthetic account credentials, or fixture IDs are
available in this environment. Preflight and static runtime contract checks can run without a connection,
but they are not hosted Realtime evidence. Provision the fixture, inject values securely, rerun, and store
only redacted pass/fail/timing output in private release evidence.
