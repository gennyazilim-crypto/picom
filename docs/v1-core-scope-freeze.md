# Picom V1 Core Scope Freeze

## Release identity

- Product: Picom
- Release: `1.0.0`
- Channel: `stable`
- Supported stable platform: **Windows only**
- Authoritative runtime registry: `src/config/v1ReleaseScope.ts`
- Decision status at Task 617: **NO-GO** until the remaining release blockers close

Linux and macOS remain engineering targets. Picom V1 release copy, About metadata, support guidance, and distribution claims must not describe either platform as stable.

## Classification rules

| Classification | Meaning |
| --- | --- |
| `IN_V1` | Required, visible, production-backed V1 Core behavior. |
| `CONDITIONAL` | Hidden by default and included only after named evidence is recorded. |
| `HIDDEN_FROM_V1` | Code and data are retained, but no V1 navigation, onboarding, badge, deep link, help, or release-copy entry may expose it. |
| `POST_V1` | Explicit roadmap work outside V1 Core. |
| `BLOCKER` | Required release evidence or behavior that prevents a Go decision. |

## IN_V1

- Secure Electron desktop shell and Windows first launch
- Supabase Auth and session restore
- Text/community Feed
- Text communities, channels, roles, membership, invites, moderation, and audit controls
- Text messages, image attachments, replies, reactions, unread/read state
- Profiles, avatar/cover, privacy, verification display
- Friends and participant-only Direct Messages
- User Settings, Help, redacted diagnostics, and V1-safe global search

Production V1 must not fall back to mock data. Task 618 owns the final data-source enforcement and evidence.

## CONDITIONAL

| Feature | V1 default | Required evidence |
| --- | --- | --- |
| Voice Rooms | Hidden | Task 621 hosted LiveKit, two-client, Windows microphone/device, disconnect/reconnect, and permission evidence |
| Screen Share | Hidden | Task 621 Windows desktop capture, source selection, LiveKit publication, stop/recovery, and permission evidence |

Conditional does not mean available. Both features remain disabled until the registry is deliberately changed after evidence closure.

## HIDDEN_FROM_V1

- Radio
- Podcasts
- Events workspace
- Standalone Bookmarks workspace
- Meeting Workspace, camera, and stage
- Enhanced Noise Shield / Voice Focus controls
- Public discovery marketplace
- Public platform-admin operations

## POST_V1

- Bots, webhooks, plugins
- Enterprise administration, SSO, SCIM, billing
- AI features, recording, captions, AI summaries
- Linux stable release claim
- macOS stable release claim
- Custom community emoji/sticker administration

## Current blocker snapshot

The scope freeze does not convert missing evidence into a pass. At Task 617 the release remains blocked by hosted Supabase closure, Realtime/Edge Function evidence, conditional Voice/Screen Share disposition, trusted Windows signing and clean-machine installation, legal approval, production ownership, isolated backup/restore, and final RC evidence.

GitHub Actions run `29184042109` also exposed a clean-checkout build blocker: tracked renderer files imported untracked `assets/brand/picom-logo.png`. Task 617 changes those consumers to tracked `assets/brand/picom-logo-concept.png`; subsequent CI must confirm the correction.

## Change control

Any V1 scope change requires all of the following:

1. Update `src/config/v1ReleaseScope.ts`.
2. Record evidence and rationale in the relevant checkpoint.
3. Update this document and release notes.
4. Re-run the V1 scope contract and relevant quality gates.
5. Never expose a conditional or hidden feature through a route before its release evidence is approved.
