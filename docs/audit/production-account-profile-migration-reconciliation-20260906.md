# Production account-profile migration reconciliation

## Scope

Production history contains two already-applied Account Center migrations that
were absent from canonical source. They are recovered here from the remote
`supabase_migrations.schema_migrations.statements` arrays. This commit is
history reconciliation only: neither version may execute again.

| Version | Remote name | Purpose | Statements | LF SHA-256 | Classification |
| --- | --- | --- | ---: | --- | --- |
| `20260906190000` | `complete_account_profile` | Account Center profile completion RPC and additive profile metadata columns | 8 | `06733832315F352B9F6F7FD9180AB8F6D983BBA3BCF544C8C1B000AE6598AFC5` | `RECOVERED_EXACT` |
| `20260906200000` | `update_account_profile` | Account Center profile edit RPC | 6 | `B2B0C895478D1335057E813E9CD28A6C8AFCB5307D3B77E7243C2C0DD433F3D0` | `RECOVERED_EXACT` |

## Provenance

- Both versions are present in production migration history.
- Production stores their complete ordered SQL statements.
- The reconstructed LF-normalized SQL hashes above match the recovered source
  files exactly.
- No prior Git commit or remote branch contained either filename. The
  `20260906190000` Account Center live-repair record independently describes
  its apply; both versions are now attributed to the Account Center profile
  completion/edit flow.

## Safety boundary

No production migration-history row was modified. No placeholder migration,
migration repair, or schema reconstruction was used. These filenames only
allow official tooling to recognize their already-applied production versions.
