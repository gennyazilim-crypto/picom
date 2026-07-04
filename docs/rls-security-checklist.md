# RLS security checklist

Use this checklist before enabling API mode against Supabase environments beyond local development.

## Scope

This checklist applies to Picom's Supabase Auth, Postgres RLS, future Storage policies, and future Realtime subscriptions.

## Required checks

- [ ] RLS is enabled on every public MVP table.
- [ ] No desktop renderer code uses service-role keys.
- [ ] No service-role key is present in `.env`, committed docs, diagnostics, or logs.
- [ ] Profiles can be read only by the user or users sharing a community.
- [ ] Communities are visible only to owners and members.
- [ ] Membership rows are visible only to members of the same community.
- [ ] Membership management is restricted to community owners until role permissions are added.
- [ ] Public channels are visible only to community members.
- [ ] Private channels are hidden from non-owner members under the current MVP policy.
- [ ] Messages follow channel visibility.
- [ ] Message inserts require `author_id = auth.uid()`.
- [ ] Message inserts are blocked for voice channels.
- [ ] Attachments follow message visibility.
- [ ] Pending attachments are visible only to the uploader.
- [ ] `public.message_attachments` uses `security_invoker = true`.
- [ ] Reactions follow message visibility.
- [ ] Reaction inserts/deletes are limited to `user_id = auth.uid()`.
- [ ] Manual member-only community access test has been run.
- [ ] Manual private channel boundary test has been run.
- [ ] Supabase Storage bucket policies are added before real file uploads are enabled.
- [ ] Realtime subscriptions reuse channel/message visibility rules.
- [ ] Search endpoints do not return private channel messages to unauthorized users.
- [ ] Logs and diagnostics redact tokens, auth headers, cookies, and session values.

## Environment checks

- [ ] `VITE_SUPABASE_URL` points to the intended environment.
- [ ] `VITE_SUPABASE_ANON_KEY` is the anon key only, not a service-role key.
- [ ] Local development credentials are not reused in staging or production.
- [ ] Supabase Auth email/password settings match the environment purpose.
- [ ] Production secrets are managed outside the repository.

## Manual test references

- `docs/member-only-community-access-test.md`
- `docs/private-channel-access-boundaries-test.md`
- `supabase/tests/member_only_community_access.sql`
- `supabase/tests/private_channel_access_boundaries.sql`

## Remaining MVP risks

- Role-aware private channel permissions are not implemented yet.
- Storage bucket policies are not implemented yet.
- Realtime authorization still needs dedicated room/subscription checks.
- Supabase CLI is not installed in the current local environment, so SQL tests are prepared but not automatically executed here.

## Release gate

Do not ship API mode beyond internal testing until the required checks above are reviewed and the remaining risks are either fixed or explicitly accepted.