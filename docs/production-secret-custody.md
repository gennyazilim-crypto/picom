# Production Secret Custody

Status date: 2026-07-10  
Status: **BLOCKED - accountable owners and approved stores are unassigned**

No secret values belong in this document. The temporary Task 406 staging credentials were local, short-lived execution material and are not production custody.

| Secret name/category | Accountable owner | Approved store | Rotation | Recovery owner | Least-privilege use and revocation |
| --- | --- | --- | --- | --- | --- |
| Supabase production access token | UNASSIGNED | UNASSIGNED secret manager/CI | TBD | UNASSIGNED | Deployment only; revoke in account token settings |
| Supabase production database password | UNASSIGNED | UNASSIGNED secret manager | TBD | UNASSIGNED | Migration/restore operators only; rotate in provider |
| Supabase service-role key | UNASSIGNED | Supabase server/Edge/CI only | TBD | UNASSIGNED | Never renderer; revoke/rotate project key immediately on exposure |
| LiveKit API key/secret | UNASSIGNED | Edge/server secret store | TBD | UNASSIGNED | Token issuer only; revoke provider credential |
| Windows signing certificate/private key | UNASSIGNED | Managed signing service/HSM | TBD | UNASSIGNED | Release workflow only; revoke certificate and pause distribution |
| Apple Developer ID/notary credentials | UNASSIGNED | Keychain/CI secret store | TBD | UNASSIGNED | macOS release workflow only; revoke credential/certificate |
| Linux repository signing key | UNASSIGNED | Hardware/protected CI store | TBD | UNASSIGNED | Repository metadata only; revoke and publish key transition |
| OAuth provider client secrets | UNASSIGNED | Server/provider secret store | TBD | UNASSIGNED | Provider callback only; revoke at provider |
| Email provider credentials | UNASSIGNED | Server/Edge secret store | TBD | UNASSIGNED | Transactional mail only; revoke provider key |
| Crash/analytics private credentials | UNASSIGNED | Server/CI secret store | TBD | UNASSIGNED | Disabled until owner/privacy approval; revoke provider key |
| Backup encryption/recovery credentials | UNASSIGNED | Approved recovery vault | TBD | UNASSIGNED | Restore operators only; revoke and re-encrypt future backups |

## Required closure

For every row, record a real person/team role, approved store, last/next rotation date, backup recovery owner, emergency contact, and tested revoke procedure. Then freeze production values by identifier/version only. Missing ownership blocks stable release.