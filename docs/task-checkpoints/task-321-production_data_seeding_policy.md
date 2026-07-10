# Task 321 - Production data seeding policy

## Completed

- Set production seed default to empty: no dev users/passwords, demo communities, messages, or user data.
- Marked `supabase/seed.sql` explicitly local-reset-only and prohibited remote include/paste workflows.
- Defined transactional/idempotent Owner/Admin/Moderator/Member/Guest and category defaults per community.
- Kept app-admin creation in the separate guarded Auth/operator bootstrap process.
- Documented migration versus tenant-default versus local/staging fixture boundaries and release scans.
- Recorded that production transactional community-default RPC/concurrency evidence is still required.

## Validation

- `npm run production:seed:policy:smoke`
- `npm run admin:bootstrap:smoke`
- `npm run supabase:smoke`
- `npm run maintenance:scripts:smoke`

Typecheck/build are skipped because this task changes policy documentation, a SQL comment, and a
documentation/static smoke script only; no runtime source, schema behavior, dependency, UI, or desktop flow
changed.

## Remaining production gate

Implement and hosted-test a transactional, idempotent community creation RPC before claiming production
community defaults are complete. Never use production seed data as a workaround.
