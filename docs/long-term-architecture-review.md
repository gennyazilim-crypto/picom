# Final Long-Term Architecture Review

Picom is a Windows, Linux, and macOS Electron desktop community chat app. The long-term direction is a premium desktop-first product with a React + TypeScript renderer, safe Electron shell, Supabase backend foundations, and LiveKit/WebRTC media.

## Strong areas

- Clear desktop-only product direction.
- Premium four-column UI architecture with Picom branding and design tokens.
- Electron shell hardening foundations: custom titlebar, preload/service abstraction, no native menu, and security smoke tests.
- Supabase-first backend strategy: Auth, Postgres, RLS, Storage, Realtime, and Edge Functions.
- LiveKit/WebRTC media direction with token Edge Function boundary.
- Strong documentation discipline for release, security, compliance, operations, and QA.
- Mock mode and Supabase mode are separated through service/data-source layers.
- No Discord branding/assets/exact colors are allowed by project guardrails.
- Coolicons/AppIcon is the approved icon path with attribution.

## Weak areas

- Many advanced features are placeholders and should remain disabled until MVP flows are stable.
- `App.tsx` has accumulated a large amount of orchestration state.
- Settings modal contains many unrelated settings sections and could become difficult to maintain.
- Supabase live RLS testing still requires manual/local or staging validation.
- Realtime reliability and large-scale message handling need more live testing.
- LiveKit voice/screen share needs platform-specific QA across Windows, Linux, and macOS.
- Bundle size is above Vite's warning threshold.
- Full i18n extraction is not complete.

## Technical debt

- Large renderer component orchestration in `App.tsx`.
- Some placeholder services may outlive their intended MVP purpose.
- Documentation volume is high and needs periodic pruning/indexing.
- Feature flags and placeholders need a single release-readiness matrix.
- Some visual token usage may still have legacy hardcoded values.
- Runtime tests are mostly smoke/static; fewer full interaction tests exist.

## Refactor candidates

- Split `App.tsx` orchestration into focused hooks:
  - community/channel state
  - messaging state
  - auth/session state
  - overlays
  - realtime/presence
  - settings/accessibility
- Split SettingsModal sections into separate components.
- Normalize entity state for users, communities, channels, messages, members, roles, and notifications.
- Introduce typed API SDK or generated DTOs after backend contracts stabilize.
- Lazy-load heavy optional views and LiveKit code paths to reduce startup bundle size.
- Create a release documentation index to reduce scattered operational docs.

## Risky modules

- Electron main/preload IPC and window service boundaries.
- Auth/session restore and revoked session handling.
- Supabase RLS policies for private channels, attachments, search, and reports.
- Realtime message reconciliation and duplicate prevention.
- Upload validation, storage paths, and attachment access control.
- LiveKit token generation and screen share permissions.
- Local settings migration and safe mode/crash recovery.
- Feedback/log/diagnostics exports and redaction.

## Scalability considerations

- Message lists need virtualization before very large channels.
- Member lists need virtualization for large communities.
- Search needs backend-side permission-aware indexing.
- Realtime fanout should stay Supabase-backed for MVP; alternate pub/sub should wait until real scale pressure appears.
- Attachment thumbnails, malware scanning, and signed/private URLs should be implemented before public production upload scale.

## Recommended next 10 tasks

1. Stabilize startup/auth/session restore with live Electron smoke tests.
2. Complete Supabase RLS live tests for member-only and private-channel boundaries.
3. Run two-window realtime testing against Supabase.
4. Run upload/storage tests for public and private channel image attachments.
5. Verify LiveKit voice join/leave/mute/deafen/screen-share across platforms.
6. Add focused Playwright or equivalent desktop interaction smoke tests for the MVP shell.
7. Split SettingsModal sections into small components without changing visual design.
8. Add MessageList virtualization preparation for large channels.
9. Add bundle analysis and lazy-load LiveKit/optional views.
10. Build and smoke-test unsigned Windows, Linux, and macOS packages.

## What should not be built yet

- Bot marketplace.
- Production webhooks.
- Plugin runtime.
- Enterprise admin console.
- SSO and SCIM.
- Billing.
- Public discovery marketplace.
- Production auto-update.
- E2EE production.
- Advanced analytics.
- Mobile app or mobile layout.

## Architecture decision

Continue with a conservative MVP-first architecture. Keep advanced systems documented but disabled until core desktop chat, Supabase auth/RLS, realtime, uploads, LiveKit, packaging, and security gates are stable.
