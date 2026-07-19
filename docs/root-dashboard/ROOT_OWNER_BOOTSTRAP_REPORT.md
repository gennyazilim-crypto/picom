# Root Owner Bootstrap Report (Task 02)

## 1. Summary of what was implemented

Secure owner bootstrap binds `f.tayboga@gmail.com` to a persistent `user_id` row in `public.root_owners`, grants matching `app_admins` membership, and assigns `platform_role_assignments.role_key = 'root_owner'`. Authorization is always evaluated via `auth.uid()` through `is_root_owner()` / `is_app_admin()` / `has_platform_role()`, never by trusting a client-reported email.

Bootstrap SQL runs inside migration `20260715140000_root_dashboard_operations_core.sql`: it selects from `auth.users` by lowercased email and inserts only when that user exists (`ON CONFLICT DO NOTHING`).

## 2. Files changed

| Path | Change |
|------|--------|
| `supabase/migrations/20260715140000_root_dashboard_operations_core.sql` | `root_owners`, `is_root_owner()`, bootstrap `DO` block |
| `src/services/rootDashboard/rootDashboardAccessService.ts` | Access resolution via admin operations |
| `src/components/rootDashboard/PanelEntryButton.tsx` | Gated Panel entry |
| `src/components/navigation/GlobalAppSidebar.tsx` | Hosts Panel button |
| `docs/root-dashboard/ROOT_OWNER_BOOTSTRAP_REPORT.md` | This report |

## 3. Migrations / RLS

- Table `root_owners` (`user_id` PK → `profiles`), `activated_at`, optional `revoked_at`, RLS enabled, **no** direct grants to `anon`/`authenticated`.
- Function `is_root_owner()` — `SECURITY DEFINER`, `search_path = public`, execute for `authenticated`.
- Bootstrap inserts into `root_owners`, `app_admins`, `platform_role_assignments` for resolved owner id.
- Follow-on: `20260715141000_root_dashboard_mutations_rbac_mfa.sql` (in progress) for mutation RPCs + MFA step-up.

## 4. APIs / realtime

- No public “claim root by email” endpoint.
- Client uses session JWT; RPCs read `auth.uid()`.
- Access probe: `rootDashboardAccessService.resolveAccess()` → `adminOperationsService.getAccess()`.

## 5. Verification

1. Apply migration to target DB.
2. `select user_id, activated_at, revoked_at from root_owners;` — expect one active row after owner has signed up.
3. Sign in as owner → sidebar Panel visible and openable.
4. Sign in as non-admin → Panel denied / hidden.
5. Confirm client cannot force access by spoofing email in local state.

Typecheck/smoke: `npm run typecheck`; `node scripts/root-dashboard-ui-smoke.mjs`.

## 6. Security / privacy

- Email is lookup key in migration only; runtime auth is `user_id`.
- Revocation: set `revoked_at` on `root_owners` (and revoke role assignment) without deleting history.
- Least privilege: operational tables remain revoked at table level.

## 7. Remaining blockers

- Hosted migration not yet applied → bootstrap does not exist in production until push.
- If owner Auth user is missing, bootstrap `DO` block skips inserts (expected).

## 8. Next task

**Task 03 — Root Role RBAC and Permission Model** → `RBAC_PERMISSION_MATRIX.md`, `TASK_03_RBAC_REPORT.md`
