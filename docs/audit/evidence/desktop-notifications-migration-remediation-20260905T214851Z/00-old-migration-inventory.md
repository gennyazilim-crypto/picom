# Old migration inventory

Old migration: `20260904100000_production_desktop_notifications.sql`
Old LF-normalized SHA-256: `5FAFBABF8A31812C2F23E3D5C7FCC4E9B0A4709C0754ADA07474B626B26EF502`

Read-only Supabase migration-history checks found `20260904100000` absent from
the remote history of every currently accessible managed project:

- `picom-production` / `cqnsetsmcduraryemhbi`
- `picom-staging` / `ufmtvqtsklqsmqxefbbs`
- `picom-staging-v2` / `kbdotviopwlcqviggtrc`
- `picom-community-creation-validation-20260831` / `ighyekrjrxnlxyoyhhzj`
- `f.tayboga@gmail.com` / `gocyorbgqfxwlzlphhvh`

The old file was present only in canonical local source. The local Supabase
database was not running, so local runtime migration history could not be
queried; it was not used as release evidence.

The failed production transaction remains documented in the prior evidence
bundle. No earlier evidence was edited. Status:

`20260904100000 = SUPERSEDED_UNAPPLIED_INVALID_MIGRATION`.
