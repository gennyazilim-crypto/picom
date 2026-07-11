# Task 496 checkpoint

## Completed

- Replaced the Community Admin invite placeholder with a real lifecycle list.
- Added active, revoked, expired, and exhausted filters plus creator and aggregate usage metadata.
- Added confirmed row-level revocation and retained the validated invite creator.
- Added service-level maximum-use and expiry validation.
- Added type-aware destination copy for Text, Radio, and Podcast invites.
- Reused existing public-read, private-community, owner-transfer, ban, block, join, and leave enforcement.

## Validation results

- PASS: `npm run community:invites-access:smoke`
- PASS: `npm run invites:acceptance:production:test`
- PASS: `npm run community:public-join:production:test`
- PASS: `npm run community:typed-join:smoke`
- PASS: `npm run community:settings:persistence:test`
- PASS: `npm run community:access:smoke`
- PASS: `npm run blocking:privacy:smoke`
- PASS: `npm run community:ownership-transfer:smoke`
- PASS: `npm run typecheck`
- PASS: `npm run mock:smoke`
- PASS: `npm run build`
- PASS: `npm run qa:smoke`
- PASS: `npm run performance:budget:ci` (`initialJs` 1610.8 KiB and `initialCss` 230.2 KiB; both below hard caps)

Hosted Supabase RLS execution remains BLOCKED without an approved CLI/staging credential context. Structural and production-contract smokes do not fabricate hosted evidence.
