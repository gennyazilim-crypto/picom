# Picom Beta Go / No-Go

Use this document for the formal decision to distribute a Picom Full MVP beta candidate.

## Decision options

| Decision | Meaning |
| --- | --- |
| `GO` | Every blocker passed; no unresolved release-blocking issue exists |
| `GO WITH NON-BLOCKERS` | Every blocker passed; remaining issues are documented, owned, and safe for the beta audience |
| `NO-GO` | One or more blockers failed, remain unverified, or lack acceptable mitigation |

An unverified blocker is treated as failed. Documentation of a platform gap does not by itself make a package-launch blocker pass.

## Current decision record

| Field | Value |
| --- | --- |
| Decision | `NO-GO` |
| Date | 2026-07-10 |
| Version | `0.1.0-beta` placeholder |
| Channel | Beta |
| Reason | Windows installer now builds, but clean-account package launch plus Supabase staging/RLS, LiveKit two-client voice, and screen-share checks remain unverified |
| Current Windows artifact | `Picom-0.1.0-Windows-x64.exe` / SHA-256 `2461CE1C18CEEFD0003FB85B4212BB1DE084AAAC2E3BAE9BE6F77B98CC63230C` |
| Decision owner | Pending |

This record must be updated by the release owner after all required evidence is attached.

## Exact next action

1. Install the current Windows artifact on a clean test account and complete launch/login/onboarding/chat/restart/uninstall smoke testing.
2. Build and launch the Linux AppImage/deb on a supported native Linux host.
3. Build and launch the macOS dmg/zip and complete microphone/screen-recording permission checks on native macOS.
4. Configure Supabase staging, apply migrations, and pass separate-account RLS tests for public/private community, channel, message, attachment, membership, and invite boundaries.
5. Deploy the LiveKit token function and pass two-client voice plus remote screen-share smoke testing.
6. Re-run this checklist; choose `GO WITH NON-BLOCKERS` only if every blocker passes and remaining limitations have owners/workarounds.

## Product

- [ ] `[BLOCKER]` Approved Full MVP scope matches the candidate and release notes.
- [ ] `[BLOCKER]` Login, community/channel chat, messaging, uploads, Mention Feed, Profile Page, role-aware menu, visitor flow, voice, and screen share are present in the intended beta configuration.
- [ ] `[BLOCKER]` No advertised core flow is a non-functional placeholder.
- [ ] `[VERIFY]` Post-MVP exclusions remain hidden or clearly unavailable.
- [ ] `[VERIFY]` [Beta release notes](beta-release-notes.md) and [known issues](beta-known-issues.md) are current.

## Desktop UI

- [ ] `[BLOCKER]` Electron app starts without a critical renderer crash.
- [ ] `[BLOCKER]` Native File/Edit/View menu remains disabled and the custom titlebar/window controls work.
- [ ] `[BLOCKER]` Community chat, Mention Feed, Profile Page, settings, modals, and image preview open without breaking the shell.
- [ ] `[BLOCKER]` No mobile UI, Discord branding, copied assets, or exact Discord colors appear.
- [ ] `[VERIFY]` Normal/maximized frame behavior, light/dark themes, scrolling, and pinned composer pass visual smoke testing.

## Auth

- [ ] `[BLOCKER]` Email registration, login, logout, and session restore pass against Supabase staging.
- [ ] `[BLOCKER]` First-run onboarding creates/completes a safe profile.
- [ ] `[VERIFY]` Google/Apple login passes only when advertised and providers are configured.
- [ ] `[BLOCKER]` External beta registration presents and records required legal acceptance.

## Supabase

- [ ] `[BLOCKER]` Staging migrations are applied and schema smoke checks pass.
- [ ] `[BLOCKER]` Auth, community/channel/message, upload, and realtime two-window flows pass in staging.
- [ ] `[BLOCKER]` Renderer contains no service-role key or other privileged backend credential.
- [ ] `[VERIFY]` Staging outage and error states are understandable and do not crash the shell.

## RLS and security

- [ ] `[BLOCKER]` Visitor cannot read private communities, private channels, private messages, or private attachments.
- [ ] `[BLOCKER]` Visitor cannot send, react, reply, or upload before joining.
- [ ] `[BLOCKER]` Member cannot perform owner/admin/moderator actions without permission.
- [ ] `[BLOCKER]` Private-channel and cross-community isolation tests pass with separate accounts.
- [ ] `[BLOCKER]` No Supabase service-role key, LiveKit secret, auth token, password, or signing secret is exposed in source, bundle, logs, or diagnostics.
- [ ] `[VERIFY]` Safe preload, `contextIsolation`, disabled Node integration, sandbox, navigation guards, and external-link controls remain enabled.

## Messaging

- [ ] `[BLOCKER]` Send, optimistic confirmation, edit-own, delete-own, moderator delete, and realtime insert/update/delete pass.
- [ ] `[BLOCKER]` Duplicate realtime echo does not duplicate an optimistic message.
- [ ] `[BLOCKER]` Emoji insertion, reaction add/remove/counts, reply preview, and deleted-reply fallback pass.
- [ ] `[VERIFY]` Typing, unread, mention, and failure/retry states behave without crashing.

## Upload

- [ ] `[BLOCKER]` Valid PNG/JPG/WebP/GIF upload succeeds within the configured size limit.
- [ ] `[BLOCKER]` Invalid type and oversized file are rejected safely.
- [ ] `[BLOCKER]` Storage access follows channel visibility and does not leak private attachments.
- [ ] `[VERIFY]` Attachment grid and image preview work in light/dark themes.

## Voice and screen share

- [ ] `[BLOCKER]` Two clients join the same LiveKit staging room and see accurate participant state.
- [ ] `[BLOCKER]` Mute, deafen, speaking, leave, reconnect, and token failure paths do not crash.
- [ ] `[BLOCKER]` Screen share starts/stops safely if advertised as included.
- [ ] `[VERIFY]` Windows microphone/capture permissions are tested.
- [ ] `[VERIFY]` Linux microphone/capture permissions are tested.
- [ ] `[VERIFY]` macOS microphone/screen-recording permissions are tested.
- [ ] `[VERIFY]` Any platform limitation is recorded in [known issues](beta-known-issues.md).

## Packaging

- [x] `[VERIFY]` `npm run typecheck`, `npm run mock:smoke`, `npm run build`, and `npm run package:verify` pass on the current Windows source checkout.
- [ ] `[BLOCKER]` Windows beta artifact is installed, launched, and uninstalled on a clean test account. Artifact production passes.
- [ ] `[BLOCKER]` Linux beta artifact is produced, installed, launched, and uninstalled on a supported distribution.
- [ ] `[BLOCKER]` macOS artifact is produced, launched, and permission-tested if macOS is included in this beta ring.
- [ ] `[VERIFY]` App metadata, icons, custom protocol, packaged preload, and staging configuration are correct in each artifact.
- [x] `[NON-BLOCKER]` Unsigned local beta warnings are documented.

## Legal

- [x] `[VERIFY]` Terms, privacy, community guidelines, and third-party attribution placeholders are present.
- [ ] `[BLOCKER]` External beta testers accept the required legal documents during registration/onboarding.
- [ ] `[VERIFY]` Release notes avoid production security, availability, encryption, or compliance claims.

## Diagnostics

- [ ] `[BLOCKER]` Critical crashes and startup failures produce a recoverable, redacted diagnostic path.
- [ ] `[VERIFY]` Feedback form, logs viewer, diagnostics summary, copy/export, and clear actions work.
- [ ] `[BLOCKER]` Exported logs/diagnostics do not expose tokens, passwords, authorization headers, privileged keys, or unnecessary private content.

## Known issues

- [x] Windows electron-builder `EPERM` process-lock issue is resolved for the current candidate and documented.
- [x] Unsigned build warning is recorded.
- [x] Vite chunk-size warning is recorded as non-critical.
- [x] Supabase CLI/staging and LiveKit staging requirements are recorded.
- [x] macOS and Linux native QA requirements are recorded.
- [ ] Every open beta issue has severity, owner, mitigation, and retest status.

## Immediate NO-GO blockers

Choose `NO-GO` if any condition is true:

- App or packaged candidate does not start.
- Login/register or message send is unusable.
- A critical renderer/native crash remains.
- Private community/channel/message/attachment data leaks.
- RLS permits an unauthorized read or write.
- A service-role key, LiveKit secret, password, token, certificate, or signing password is exposed.
- A target-platform package cannot launch.
- Screen sharing crashes while screen sharing is advertised as included.
- Data loss or corruption is reproducible.
- Required legal acceptance is missing for external beta users.

## Allowed non-blockers

These may support `GO WITH NON-BLOCKERS` only after all blockers pass:

- Minor visual polish issue with no interaction/accessibility impact
- Documented unsigned-build warning for an approved internal tester group
- Existing non-critical Vite bundle-size warning
- Minor, documented platform limitation with a safe fallback
- Clearly unavailable post-MVP placeholder that does not affect Full MVP flows

## Sign-off

| Area | Name | Decision | Date | Notes/evidence |
| --- | --- | --- | --- | --- |
| Product | | Pending | | |
| Engineering | | Pending | | |
| QA | | Pending | | |
| Security | | Pending | | |
| Operations / support | | Pending | | |

## Final release decision

- Decision: `GO | GO WITH NON-BLOCKERS | NO-GO`
- Version/build:
- Release channel:
- Date/time:
- Decision owner:
- Evidence links:
- Non-blockers accepted:
- Rollback/withdrawal owner:
