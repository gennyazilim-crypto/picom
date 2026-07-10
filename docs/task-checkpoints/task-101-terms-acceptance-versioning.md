# Task 101 checkpoint: Terms acceptance versioning

## Delivered

- Central typed legal version configuration.
- Registration checkbox tied to required version metadata.
- Profile fields for terms/privacy version and server acceptance timestamps.
- Authoritative policy version table and append-only acceptance evidence.
- Protected database write path preventing direct acceptance-field spoofing.
- Blocking desktop re-acceptance view with policy links and sign-out choice.
- Settings Legal section displays the current acceptance version.
- Legacy mock seed bypass plus versioned mock registration/re-acceptance.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

Live trigger and RLS execution remains a staging/Supabase CLI check.
