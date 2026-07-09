# Picom Beta Test Flows

Run these flows against the exact beta artifact and record platform, build/hash, data-source mode, test account, result, and redacted evidence.

## 1. Desktop shell

- [ ] Launch Picom and confirm no native File/Edit/View menu appears.
- [ ] Test minimize, maximize/restore, close, titlebar drag, search input, and theme toggle.
- [ ] Confirm normal mode uses the premium frame and maximized mode fills the content area.
- [ ] Close/reopen Picom and verify theme/window state persistence.

## 2. Account and onboarding

- [ ] Register with email/password after accepting Terms and Privacy.
- [ ] Complete Profile, Theme, Community, Follow, and Finish onboarding steps.
- [ ] Confirm Finish opens Mention Feed and onboarding does not repeat after restart.
- [ ] Log out/in and verify session behavior.
- [ ] Test Google/Apple only when the staging provider is enabled; otherwise verify a clean disabled explanation.

## 3. Mention Feed and profile

- [ ] Switch Feed and Takip Ettigin Kisiler tabs.
- [ ] Open followed-person stories, navigate previous/next, and verify seen state.
- [ ] Inspect reactions, commenter avatars, comment previews, friends/events companion rail, and voice mini card.
- [ ] Open a user Full Profile Page from feed, member, and message entry points.
- [ ] Return to the previous view and open linked activity in a channel.

## 4. Communities and permissions

- [ ] Create or join a community and switch communities/channels.
- [ ] Verify owner, limited admin, moderator, member, and visitor menus with separate accounts.
- [ ] Verify visitor public-read mode and disabled composer.
- [ ] Verify visitors cannot see private channels/messages/attachments or react/upload.
- [ ] Join a public community, then leave and confirm safe visitor/private behavior.
- [ ] Create/copy/accept a bounded invite and test invalid/expired/revoked cases.

## 5. Messaging and uploads

- [ ] Send a message and verify optimistic/realtime reconciliation without duplicates.
- [ ] Edit/delete own message and test moderator deletion with permission.
- [ ] Insert emoji, add/remove reactions, reply, and verify deleted-reply fallback.
- [ ] Upload valid PNG/JPG/WebP/GIF images and open Image Preview.
- [ ] Verify oversized/invalid uploads fail cleanly and private attachments remain inaccessible.

## 6. Realtime

- [ ] Use two staging clients in the same channel.
- [ ] Verify insert/update/delete delivery, typing state, reconnect, and no duplicate messages.
- [ ] Revoke membership/private access and verify new reads/writes are denied.

## 7. Voice and screen share

- [ ] Join one LiveKit staging voice channel from two clients.
- [ ] Verify mute/unmute, deafen/undeafen, speaking indicator, leave/rejoin, and participant cleanup.
- [ ] Open the Electron source picker, start/stop screen share, and confirm the remote track.
- [ ] Test OS permission denial/recovery using `docs/livekit-smoke-test.md`.

## 8. Support and safety

- [ ] Open Settings > Diagnostics and inspect the auth/data-source/realtime/LiveKit summaries.
- [ ] Copy/export diagnostics and verify secrets/tokens/passwords are absent.
- [ ] Filter, copy, export, and clear redacted logs.
- [ ] Build a feedback report and confirm Picom only copies it; no backend submission is claimed.

## 9. Packaging

- [ ] Verify the artifact checksum.
- [ ] Install, launch, close/reopen, and uninstall on the target OS.
- [ ] Confirm login/register, Mention Feed, community chat, message send, and theme persistence in the packaged app.
- [ ] Confirm microphone, screen capture, protocol links, tray, and custom titlebar behavior natively.

Any private-data leak, secret exposure, package launch failure, unusable auth/message send, data loss, or repeated critical crash is an immediate `NO-GO`.

