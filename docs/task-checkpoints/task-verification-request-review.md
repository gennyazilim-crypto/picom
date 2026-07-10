# Task checkpoint: Verification request and review MVP

## Result

Profile and community verification requests are available from their existing desktop settings surfaces. The protected Admin Operations panel contains a review queue with approve, reject, and revoke actions. Every Supabase decision passes through reviewer-only functions and the existing append-only verification audit path.

## Privacy and security

- No paid verification or document upload exists.
- Forms accept public context, HTTPS official links, category, reason, and optional supporting text only.
- Normal users receive their own status and redacted decision reason through scoped RPCs.
- Private request text and reviewer context are available only in the protected review queue.
- Users have no status-update grant and cannot self-approve.
- Approved/revoked decisions update the trusted badge projection.

## Validation

```powershell
npm run verification:badges:smoke
npm run supabase:smoke
npm run supabase:rls:smoke
npm run typecheck
npm run mock:smoke
npm run build
```
