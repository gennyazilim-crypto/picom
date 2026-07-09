# Picom MVP+ Scope Lock

## Status

**Proposed/locked planning scope; implementation is not authorized by this document.**

MVP+ begins only after the Full MVP stable blockers in `docs/stable-go-no-go.md` are closed and a new stable release decision approves forward product work. Existing placeholder/foundation code does not prove a feature is production-ready or automatically include it in a release.

## Product direction

- Desktop-only Electron app for Windows, Linux, and macOS.
- Preserve Picom custom chrome, premium desktop information density, design tokens, light/dark themes, and Coolicons/AppIcon.
- Supabase remains the primary Auth/Postgres/RLS/Storage/Realtime/Edge backend.
- LiveKit remains the approved voice/screen-share boundary.
- Backend/RLS authorization remains authoritative; UI gating is UX only.
- No mobile or browser-first layout.

## Phase 0 - stable blocker closure

Not MVP+ feature work. Must complete first:

1. Live Supabase migration/RLS/Storage/Realtime/Edge verification.
2. Historical private attachment signed-URL refresh.
3. LiveKit deployed/native two-client verification.
4. Native Linux/macOS packaging and stable signing/notarization.
5. Stable Windows signing/lifecycle smoke.
6. Real backup restore drill.
7. Legal/privacy/publisher/support sign-off.

## MVP+ priority sequence

### MVP+ A - account, safety, and reliability

Candidate scope:

- Password reset and email verification hardening.
- User blocking with backend/RLS enforcement.
- Full notification routing/preference reliability.
- Slow mode enforcement and polished countdown/error states.
- Saved messages with access-safe jump behavior.
- Delivery status and privacy-respecting read receipt opt-in.

Why first: these improve account recovery, abuse protection, and daily reliability without creating a second major communication graph.

Required gate:

- Final data models/RLS, abuse/privacy policy, error taxonomy, migration/backward compatibility, offline/realtime behavior, and native notification QA.

### MVP+ B - friends and Direct Messages

Candidate scope:

- Friends requests/accept/remove/block integration.
- Who-can-request/who-can-DM privacy controls.
- One-to-one Direct Messages.
- DM unread/notification/draft/search/attachment behavior.

Required gate:

- Explicit social graph and DM threat model.
- New schema/RLS isolation tests, report/block/spam/rate limits, retention/deletion/export behavior, attachment visibility, Realtime rooms, notification privacy, and moderation/support policy.
- DM content must not leak into community feed/search/profile activity.

Friends/DM must ship together with safety controls, not as a UI-only social surface.

### MVP+ C - advanced moderation

Candidate scope:

- Expanded reports/appeals/moderation queue.
- Blocked-word/rate-limit signal integration.
- Timeouts/kick/ban/message actions with immutable audit events.
- Permission hierarchy and evidence-safe moderation context.

Required gate:

- Clear policies, appeals, audit immutability, role hierarchy/RLS, data minimization, retention, abuse prevention, and moderator UX/native QA.

### MVP+ D - bot and webhook foundations

Candidate scope:

- Server-side bot identity/token lifecycle and constrained permissions.
- Inbound webhooks with one-time token display, hashing/revocation, rate limits, audit logs, and safe message marking.
- Slash command registration contract for approved server-side integrations.

Required gate:

- Separate Bot API security review, quotas, token rotation, abuse controls, audit logging, developer terms, versioning, and no arbitrary desktop code execution.
- Webhooks never become a bypass around community/channel permissions, attachment validation, or moderation.

No marketplace or plugin runtime is included.

### MVP+ E - evaluated expansion candidates

Require separate product evidence and approval after A-D:

- Public community discovery with listing moderation/report/age/region/privacy/anti-spam controls.
- Steam/Epic login after provider policy, desktop OAuth/deep-link, account-linking, recovery, privacy, and support review.
- Additional receipt/notification/community management refinements driven by measured feedback.

Public discovery is not approved merely because a placeholder view exists.

## Cross-cutting definition of done

Every implemented MVP+ feature requires:

- Product brief and explicit inclusion decision.
- Safe shared DTO/schema/migration and backward compatibility.
- Supabase RLS/Storage/Realtime/Edge authorization tests.
- Privacy/security/abuse/data retention/deletion/export review.
- Offline/idempotency/optimistic/reconnect/conflict behavior.
- Error/diagnostics redaction and monitoring/rollback plan.
- Windows/Linux/macOS desktop UX and package smoke.
- Typecheck, QA/static tests, build, checkpoint, commit, and staged rollout evidence.
- Updated user-facing Terms/Privacy/help where behavior changes.

## Priority authority

- P0 security/data loss/core availability defects interrupt all MVP+ work.
- P1 next-patch reliability can interrupt planned feature work with release owner approval.
- New product scope cannot be smuggled through a bugfix or placeholder completion.
- One bounded task/commit/checkpoint at a time remains the execution model.

## Review cadence

Review after stable launch evidence and each minor release. Changes require a dated scope decision with rationale, dependencies, risks, exclusions, and owner sign-off.
