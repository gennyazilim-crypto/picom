# Task 486 - Profile and Privacy Settings Full MVP

Date: 2026-07-11

## Outcome

Profile and Privacy Settings now share the existing service/RLS architecture with the Full Profile page. Profile identity remains owned by profileService; profile visibility by profilePrivacyService; DM privacy by directSafetyService; friend-request privacy by userSafetyCenterService; and blocked relationships by userBlockingService.

## Changes

- Added profile privacy subscriptions so an open current-user Profile page reflects Settings changes immediately.
- Hydrates remote profile privacy, friend-request privacy, DM privacy, and blocked users when Privacy & Safety opens.
- Added rollback and accurate error feedback for failed friend-request privacy persistence.
- Removed the duplicate local-only DM selector; the remaining selector uses the server-enforced direct-message privacy service.
- Mirrors the authoritative DM selection only for the local safety summary.
- Corrected failed profile privacy copy to state that the previous value was restored.
- Added clear visitor/public-profile behavior: public basics do not bypass relationship or private-channel activity/media checks.
- Preserved independent controls for online status, location, timezone, activity, media, communities/roles, friends, follows, and Radio/Podcast activity.

## Validation

- npm run settings:profile-privacy:smoke: PASS
- npm run profile:privacy:smoke: PASS
- npm run profile:access:smoke: PASS
- npm run profile:domain:smoke: PASS
- npm run profile:full-mvp:qa: PASS
- npm run blocking:privacy:smoke: PASS
- npm run safety:center:smoke: PASS
- npm run dm:privacy:safety:smoke: PASS
- npm run friends:production:smoke: PASS
- npm run typecheck: PASS
- npm run mock:smoke: PASS
- npm run supabase:rls:smoke: PASS structural
- npm run build: PASS
- npm run qa:smoke: PASS
- npm run performance:budget:ci: PASS hard caps

Performance warnings remain below hard caps: initial JS 1583.5 KiB, initial CSS 229.8 KiB, and total assets 3092.3 KiB. The existing voiceService static/dynamic import warning is unrelated.

## Manual and external evidence

Static and mock contracts verify current-profile synchronization, independent section projection, blocked-user refresh/rollback, and authoritative DM/friend privacy service calls. The repository access matrix covers visitor, shared-community, friend, blocked, membership-removal, and private-source cases.

The Supabase CLI and isolated hosted staging credentials are unavailable. Real pgTAP and two-account UI verification for visitor, friend, blocked, private-channel, DM, and friend-request cases remain BLOCKED; no hosted success is claimed.
