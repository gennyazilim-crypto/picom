# Picom Product Roadmap

Picom is a Windows, Linux, and macOS Electron desktop community chat app. Mobile support is explicitly out of scope for the current roadmap.

## Phase 1 - Desktop UI foundation

Goals:

- Establish premium desktop app shell.
- Keep the four-column community chat layout stable.
- Preserve Picom brand, design tokens, light/dark mode, and Coolicons/AppIcon.

Included tasks:

- Custom Electron titlebar.
- ServerRail.
- CommunitySidebar.
- ChatMain.
- MemberSidebar.
- SettingsModal.
- Context menus and overlays.

Excluded tasks:

- Mobile layout.
- Web-first responsive redesign.
- Advanced community systems.

Dependencies:

- Electron renderer stability.
- Picom logo and palette.
- Coolicons attribution.

Success criteria:

- App opens at 1440x900.
- Minimum desktop size remains usable.
- No horizontal overflow.
- No Discord branding/assets/exact colors.

Release readiness:

- Required for every release.

## Phase 2 - Core chat MVP

Goals:

- Make the desktop app useful in mock mode and Supabase mode.

Included tasks:

- Login/register/logout.
- Community switching.
- Channel switching.
- Text messages.
- Local and Supabase message fetch/send foundations.
- Message edit/delete/reactions/replies.
- Image attachments.
- Member list and member search.
- Basic permissions.

Excluded tasks:

- Production DM backend.
- Public discovery marketplace.
- Bots/plugins/webhooks.

Dependencies:

- Supabase Auth/RLS.
- Message, channel, member, attachment services.

Success criteria:

- User can sign in, switch community/channel, send messages, upload images, and view members.

Release readiness:

- Required for MVP beta.

## Phase 3 - Backend integration

Goals:

- Connect core flows to Supabase safely.

Included tasks:

- Supabase Auth.
- Supabase Postgres schema.
- RLS policies.
- Supabase Storage.
- Supabase Realtime.
- Edge Function placeholders where secrets are required.

Excluded tasks:

- Service-role access in renderer.
- Raw database admin operations from desktop app.

Dependencies:

- Local/staging Supabase project.
- Seed data.
- RLS test scripts.

Success criteria:

- Mock mode and Supabase mode both work.
- RLS prevents cross-community/private-channel leaks.

Release readiness:

- Required for API-backed beta.

## Phase 4 - Realtime and uploads

Goals:

- Make chat feel live and image attachments reliable.

Included tasks:

- Realtime message insert/update/delete.
- Typing indicator.
- Presence foundation.
- Upload validation.
- Attachment metadata.
- Image preview.
- Reconnect and duplicate-prevention foundations.

Excluded tasks:

- Full CDN/signed URL production system.
- Malware scanning production integration.

Dependencies:

- Supabase Realtime.
- Supabase Storage policies.
- Upload service abstraction.

Success criteria:

- Two desktop clients see message changes without duplicates.
- Image uploads validate file type and size.

Release readiness:

- Required for stable realtime beta.

## Phase 5 - Permissions and moderation

Goals:

- Keep communities safe without overbuilding enterprise tooling.

Included tasks:

- Basic roles and permissions.
- Private channel foundation.
- Report management foundation.
- Community rules/welcome screening foundation.
- Moderation filter placeholders.
- Audit/logging documentation.

Excluded tasks:

- Enterprise admin console.
- Advanced trust/safety automation.

Dependencies:

- RLS and permission helpers.
- Report/moderation service foundations.

Success criteria:

- Unauthorized actions are hidden in UI and denied by backend/RLS where production-enabled.

Release readiness:

- Required before public beta communities.

## Phase 6 - Desktop packaging

Goals:

- Prepare professional Windows, Linux, and macOS builds.

Included tasks:

- electron-builder config.
- App metadata.
- Placeholder icons/assets.
- Windows/Linux/macOS smoke docs.
- Unsigned local build guidance.

Excluded tasks:

- Production code signing until certificates exist.
- Production auto-update.

Dependencies:

- Build artifacts.
- Packaging QA.

Success criteria:

- Local packages build or documented limitations are clear.

Release readiness:

- Required for beta installer smoke testing.

## Phase 7 - Beta release

Goals:

- Release a controlled beta for desktop users.

Included tasks:

- Beta release notes.
- Known issues.
- Feedback flow.
- Diagnostics export.
- QA checklists.
- Staging smoke tests.

Excluded tasks:

- Stable rollout.
- Auto-update.
- Enterprise contracts.

Dependencies:

- MVP core flows.
- Packaging smoke tests.
- Support triage process.

Success criteria:

- Beta testers know what to test and how to report bugs safely.

Release readiness:

- Gate before external beta.

## Phase 8 - Production hardening

Goals:

- Reduce launch, security, support, and operations risk.

Included tasks:

- Observability foundations.
- Incident response.
- Rollback runbook.
- Backup/restore docs.
- Dependency/security policies.
- SLO plan.
- Go/no-go checklist.

Excluded tasks:

- Enterprise-specific controls unless separately approved.

Dependencies:

- Stable beta feedback.
- Verified backup/restore.
- Monitoring plan.

Success criteria:

- Team can launch, monitor, respond, and rollback safely.

Release readiness:

- Required before stable release.

## Phase 9 - Advanced community features

Goals:

- Expand community engagement after MVP stability.

Included tasks:

- Polls.
- Events.
- Threads.
- Forum channels.
- Announcement channels.
- Saved messages.
- Custom emoji/stickers.

Excluded tasks:

- Public marketplace until moderation and anti-spam controls exist.

Dependencies:

- Stable message model.
- Permission-aware backend APIs.
- Realtime event compatibility.

Success criteria:

- Advanced features do not destabilize core chat.

Release readiness:

- Post-MVP only.

## Phase 10 - Bot, webhook, and platform features

Goals:

- Prepare safe developer extensibility.

Included tasks:

- Bot API architecture.
- Webhook foundation.
- Developer Portal placeholder.
- Slash command architecture.
- Plugin system documentation.

Excluded tasks:

- Unsafe plugin runtime.
- Arbitrary code execution.
- Public bot marketplace.

Dependencies:

- Abuse prevention.
- Audit logging.
- Rate limits.
- Permission scopes.

Success criteria:

- Integrations are safe, scoped, and auditable.

Release readiness:

- Long-term post-MVP.

## Phase 11 - Enterprise readiness

Goals:

- Support organizations only after consumer/community MVP is stable.

Included tasks:

- SSO.
- SCIM.
- Enterprise admin controls.
- Audit log exports.
- Retention/legal hold.
- Deployment/MDM guidance.
- Compliance evidence.

Excluded tasks:

- Enterprise commitments before core reliability and security gates pass.

Dependencies:

- Stable backend.
- Formal security review.
- Signed desktop packages.
- Support/monitoring processes.

Success criteria:

- Enterprise customers can deploy, govern, audit, and support Picom safely.

Release readiness:

- Long-term, not MVP.
