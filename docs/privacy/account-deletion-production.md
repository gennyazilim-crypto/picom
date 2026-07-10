# Account deletion production workflow

## Safety model

Picom uses a request, grace-period, and reviewed anonymization workflow. The desktop renderer cannot delete an Auth user, profile, community, message, attachment, or audit row directly. No production destructive job runs by default.

The user must type their exact username. The database rejects the request while the user owns any community, even if the UI check is bypassed. `request_current_user_account_deletion` atomically creates the request, marks the profile, and appends an account security event.

## Session revocation

The authenticated `account-deletion` Edge Function verifies the JWT, invokes the transactional RPC, and calls Supabase Auth global logout. The request stores whether revocation completed. The desktop signs out locally only after the endpoint succeeds. Active access tokens may remain valid until their short JWT expiry, so protected APIs and realtime connections must continue normal JWT/session checks.

## Grace period and cancellation

- The default review period is 14 days.
- A user may sign in again and cancel while the request is still `requested`.
- Cancellation clears `profiles.deletion_requested_at` and appends an immutable account event.
- Duplicate active requests are prevented by a partial unique index.
- Ownership must be transferred before the request can start.

## Final anonymization policy

Finalization is intentionally a trusted operator/background-worker responsibility and is not implemented as an automatic migration or renderer action. A reviewed implementation should:

1. Recheck that the grace period elapsed and the request was not canceled.
2. Revoke sessions again and disconnect realtime sockets.
3. Replace public profile fields with a stable deleted-user identity; clear avatar, bio, status text, and optional personal metadata.
4. Remove follows, saved items, notification preferences, and memberships according to the deletion policy.
5. Preserve message/thread continuity using the anonymized author identity where legally permitted.
6. Preserve append-only community audit and security events without tokens, passwords, raw IP addresses, or message content.
7. Apply attachment retention and legal-hold rules separately.
8. Delete or disable the Supabase Auth identity only after relational and restore implications are verified.

## Failure behavior

If the RPC fails, no request/profile/event partial state is committed. If global session revocation fails after the safe request exists, the request is marked `session_revocation_status = failed`, the UI does not claim success, and support/operator review is required. No failure path performs a hard delete.

## Staging verification

1. Apply migrations in staging and deploy `account-deletion` with JWT verification.
2. Verify a community owner is rejected by both UI and RPC.
3. Verify an incorrect username is rejected.
4. Verify a valid request creates one request and two account security events after session revocation.
5. Verify other sessions lose refresh capability and the requesting desktop returns to sign-in.
6. Sign in again during the grace period, cancel, and verify the profile marker is cleared.
7. Confirm authenticated clients cannot update/delete request or security event rows directly.

Supabase CLI is optional locally; live RLS/session tests must run in staging before release.
