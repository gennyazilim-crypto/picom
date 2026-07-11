# Picom Meeting Workspace Full MVP Scope Lock

Effective for Tasks 528–582. This document is an explicit, user-authorized extension of the earlier Picom Full MVP voice/screen-share section. All unrelated product exclusions remain in force.

## Included

- Experience modes: voice, meeting, stage.
- Layouts: auto, voice lounge, video grid, speaker focus, screen-share focus, stage/audience.
- Explicit prejoin camera/microphone/device preview.
- LiveKit audio, camera, screen share, adaptive subscriptions, reconnect, and cleanup.
- Supabase meeting schema, RLS, scheduling, invitations, join policy, waiting room, participant projection, attendance, consent, moderation, audit, notifications, and history.
- Secure meeting-aware token Edge Function and verified, idempotent LiveKit webhook receiver.
- Durable meeting chat linked to Picom messaging.
- Reactions and raise hand with bounded signaling/rate limits.
- One right dock with People, Chat, Captions, and Info.
- Host, cohost, moderator, speaker, attendee, and audience controls enforced server-side.
- Connected Voice and mini meeting integration.
- Noise Shield integration only after a real Tasks 521–527 foundation exists.
- Captions/transcript only when a configured provider, explicit consent, RLS, retention, and secret boundaries exist.
- Desktop accessibility, diagnostics, performance/bandwidth budgets, automated tests, hosted E2E, load validation, and Windows/Linux/macOS native certification.

## Explicitly excluded

- Cloud or local meeting recording.
- AI meeting summaries.
- Automatic meeting notes.
- Breakout rooms.
- Virtual backgrounds.
- External livestreaming.
- Mobile meeting UI or mobile application.
- Browser-first responsive product layout.
- Competitor branding, assets, exact colors, or copied layouts.
- Direct Supabase/LiveKit calls from React components.
- Renderer-held provider secrets.
- Fake provider participants, fake captions, fake hosted evidence, or raw placeholder controls.

Unavailable excluded controls are hidden. They are not rendered as “coming soon” buttons in the acceptance path.

## Product invariants

- Picom remains an Electron desktop app for Windows, Linux, and macOS.
- Existing Community Chat, Feed, Profile, DM, Radio, Podcast, Settings, Electron titlebar, and release safeguards remain stable.
- Picom design tokens, light/dark themes, rounded desktop surfaces, and Coolicons/AppIcon remain authoritative.
- The Meeting Workspace may use a soft-charcoal media canvas in both themes but must remain recognizably Picom.
- No mobile navigation or mobile sheet is introduced.

## Security invariants

- RLS/RPC/Edge authorization is authoritative; frontend role checks are UX only.
- LiveKit token grants are short-lived, room/identity/source bound, and derived from current server state.
- Waiting-room admission, host/cohost roles, moderation, invitations, private access, and transcript visibility fail closed.
- Webhooks are signature-verified from the raw request body and processed idempotently.
- No raw microphone, camera, or screen media is logged, persisted, uploaded, or included in diagnostics.
- Capture is explicit and stopped on close, leave, denial, replacement, crash cleanup, or source end.
- No service-role, LiveKit API secret, caption provider secret, signing key, or real credential enters renderer code or artifacts.

## Definition of Full MVP completion

The Meeting Workspace Full MVP is complete only when:

- all Tasks 530–574 local contracts pass;
- hosted two-client and multi-participant evidence from Tasks 575–577 is real and recorded;
- native certification for every promised platform is complete or that platform is removed from the release promise;
- Task 581 security/privacy/RLS gate passes;
- Task 582 reports no P0/P1 blocker and makes a truthful Go/No-Go decision.

Source-level contracts cannot substitute for provider/native evidence. Missing environments are `BLOCKED`, not `PASS`.

## Change control

Any addition outside this scope requires a new explicit scope decision. Recording, AI summaries, notes, breakout rooms, virtual backgrounds, and livestreaming cannot enter indirectly through a dependency, hidden toggle, mock menu, or provider configuration.
