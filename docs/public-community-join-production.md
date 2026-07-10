# Public community join production

Visitors may read only public, non-private content allowed by existing RLS. An authenticated visitor joins a public community through `join_public_community`, which validates visibility and bans, returns existing membership idempotently, resolves the default Member role, creates membership, and writes a redacted audit event atomically.

Private communities never use this RPC successfully. The join modal explains that an invite or approval is required and disables its public join action. Invite acceptance remains the separate Task 279 path.

After a successful or already-member response, App state replaces the member record and recalculates `CommunityAccess`. The composer is enabled only when `canSendMessage` confirms membership, channel visibility/type, and `sendMessages`; frontend state is UX while database RLS remains authoritative.

Hosted RLS and concurrent join checks require an applied Supabase migration; no hosted result is claimed here.
