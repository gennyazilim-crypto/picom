# Production Ownership Matrix

Status date: 2026-07-10  
Result: **Incomplete - named owners required before stable release**

| System | Accountable owner | Secret/config store | Backup/rotation owner | Status |
| --- | --- | --- | --- | --- |
| Supabase project/Auth | UNASSIGNED | Approved secret manager/dashboard | UNASSIGNED | Blocker |
| Database migrations/RLS | UNASSIGNED | Repository + protected deployment | UNASSIGNED | Blocker |
| Storage | UNASSIGNED | Supabase project policy | UNASSIGNED | Blocker |
| Edge Functions | UNASSIGNED | Supabase secrets/CI | UNASSIGNED | Blocker |
| LiveKit | UNASSIGNED | Provider secret store/Edge | UNASSIGNED | Blocker |
| Domain/DNS/download manifest | UNASSIGNED | DNS/release platform | UNASSIGNED | Blocker |
| Windows signing | UNASSIGNED | Managed certificate/CI | UNASSIGNED | Blocker |
| macOS signing/notarization | UNASSIGNED | Keychain/CI/notary store | UNASSIGNED | Blocker |
| Linux packaging/signing | UNASSIGNED | Protected CI/key store | UNASSIGNED | Blocker |
| Artifacts/checksums/provenance | UNASSIGNED | Immutable release storage | UNASSIGNED | Blocker |
| Support/status/incident response | UNASSIGNED | Approved support/status tools | UNASSIGNED | Blocker |
| Legal documents | UNASSIGNED | Versioned approved documents | UNASSIGNED | Blocker |
| Backups/restore | UNASSIGNED | Provider backup/PITR store | UNASSIGNED | Blocker |
| Secret rotation/recovery | UNASSIGNED | Approved secret manager | UNASSIGNED | Blocker |

No secret value belongs in this matrix. A role label or `UNASSIGNED` placeholder is not an approval or operational owner.
